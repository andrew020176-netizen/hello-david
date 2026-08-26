import { supabase } from './supabase';

function throwIfError(result) {
  if (result?.error) throw result.error;
  return result?.data;
}

export async function ensureStuffUser(user) {
  if (!user?.id) return { householdId: null };

  throwIfError(await supabase.from('stuff_profiles').upsert({ user_id: user.id }, { onConflict: 'user_id' }));
  throwIfError(await supabase.from('stuff_preferences').upsert({ user_id: user.id }, { onConflict: 'user_id' }));

  const existingResult = await supabase
    .from('stuff_household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  throwIfError(existingResult);

  if (existingResult.data?.household_id) return { householdId: existingResult.data.household_id };

  const householdResult = await supabase
    .from('stuff_households')
    .insert({ name: 'My household', owner_user_id: user.id })
    .select('id')
    .single();
  const household = throwIfError(householdResult);
  const householdId = household.id;

  throwIfError(await supabase
    .from('stuff_household_members')
    .insert({ household_id: householdId, user_id: user.id, role: 'owner' }));

  throwIfError(await supabase
    .from('stuff_household_lists')
    .insert({ household_id: householdId, items: [], updated_by: user.id }));

  return { householdId };
}

export async function loadStuffBundle(user) {
  if (!user?.id) return null;
  const { householdId } = await ensureStuffUser(user);

  const [profileResult, preferencesResult, householdResult, membersResult, listResult, invitesResult] = await Promise.all([
    supabase.from('stuff_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('stuff_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    householdId ? supabase.from('stuff_households').select('*').eq('id', householdId).maybeSingle() : Promise.resolve({ data: null }),
    householdId ? supabase.from('stuff_household_members').select('*').eq('household_id', householdId).order('joined_at', { ascending: true }) : Promise.resolve({ data: [] }),
    householdId ? supabase.from('stuff_household_lists').select('*').eq('household_id', householdId).maybeSingle() : Promise.resolve({ data: null }),
    householdId ? supabase.from('stuff_household_invites').select('*').eq('household_id', householdId).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
  ]);

  const firstError = [profileResult, preferencesResult, householdResult, membersResult, listResult, invitesResult].find(r => r?.error)?.error;
  if (firstError) throw firstError;

  return {
    householdId,
    profile: profileResult.data,
    preferences: preferencesResult.data,
    household: householdResult.data,
    members: membersResult.data || [],
    list: listResult.data,
    invites: invitesResult.data || [],
  };
}

export async function saveStuffProfile(userId, profile) {
  const payload = {
    user_id: userId,
    first_name: String(profile.firstName || '').trim() || null,
    last_name: String(profile.lastName || '').trim() || null,
    mobile: String(profile.mobile || '').trim() || null,
    suburb: String(profile.suburb || '').trim() || null,
    postcode: String(profile.postcode || '').trim() || null,
    updated_at: new Date().toISOString(),
  };
  throwIfError(await supabase.from('stuff_profiles').upsert(payload, { onConflict: 'user_id' }));

  const nextEmail = String(profile.email || '').trim().toLowerCase();
  const { data: { user } } = await supabase.auth.getUser();
  if (nextEmail && user?.email && nextEmail !== user.email.toLowerCase()) {
    const result = await supabase.auth.updateUser({ email: nextEmail });
    throwIfError(result);
    return { emailChangeRequested: true };
  }
  return { emailChangeRequested: false };
}

export async function saveStuffPreferences(userId, preferences) {
  const payload = {
    user_id: userId,
    preferred_supermarket: 'woolworths',
    match_mode: preferences.matchMode === 'cheapest' ? 'cheapest' : 'best',
    prefer_specials: !!preferences.preferSpecials,
    allow_alternatives: !!preferences.allowAlternatives,
    remember_brands: !!preferences.rememberBrands,
    updated_at: new Date().toISOString(),
  };
  throwIfError(await supabase.from('stuff_preferences').upsert(payload, { onConflict: 'user_id' }));
}

export async function saveStuffHouseholdName(householdId, name) {
  throwIfError(await supabase
    .from('stuff_households')
    .update({ name: String(name || '').trim(), updated_at: new Date().toISOString() })
    .eq('id', householdId));
}

export async function saveStuffList(householdId, userId, items) {
  throwIfError(await supabase.from('stuff_household_lists').upsert({
    household_id: householdId,
    items: Array.isArray(items) ? items : [],
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'household_id' }));
}

export async function createStuffInvite(householdId, userId, name, contact) {
  const result = await supabase.from('stuff_household_invites').insert({
    household_id: householdId,
    invited_by: userId,
    invitee_name: String(name || '').trim() || null,
    contact: String(contact || '').trim(),
  }).select('*').single();
  return throwIfError(result);
}

export async function cancelStuffInvite(inviteId) {
  throwIfError(await supabase
    .from('stuff_household_invites')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', inviteId));
}

export async function removeStuffMember(householdId, userId) {
  throwIfError(await supabase
    .from('stuff_household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', userId));
}

export function subscribeStuffList(householdId, onItems) {
  if (!householdId) return () => {};
  const channel = supabase
    .channel(`stuff-list-${householdId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'stuff_household_lists',
      filter: `household_id=eq.${householdId}`,
    }, payload => {
      const next = payload?.new?.items;
      if (Array.isArray(next)) onItems(next);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function deleteStuffAccount() {
  const { data, error } = await supabase.functions.invoke('stuff-delete-account', { body: {} });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Could not delete account.');
  await supabase.auth.signOut({ scope: 'local' });
}
