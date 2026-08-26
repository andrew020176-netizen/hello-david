import { supabase } from './supabase';

export async function ensureStuffUser(user) {
  if (!user?.id) return { householdId: null };

  await supabase.from('stuff_profiles').upsert({ user_id: user.id }, { onConflict: 'user_id' });
  await supabase.from('stuff_preferences').upsert({ user_id: user.id }, { onConflict: 'user_id' });

  const { data: existing } = await supabase
    .from('stuff_household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (existing?.household_id) return { householdId: existing.household_id };

  const { data: household, error: householdError } = await supabase
    .from('stuff_households')
    .insert({ name: 'My household', owner_user_id: user.id })
    .select('id')
    .single();
  if (householdError) throw householdError;

  const householdId = household.id;
  const { error: memberError } = await supabase
    .from('stuff_household_members')
    .insert({ household_id: householdId, user_id: user.id, role: 'owner' });
  if (memberError) throw memberError;

  await supabase.from('stuff_household_lists').insert({ household_id: householdId, items: [], updated_by: user.id });
  return { householdId };
}

export async function loadStuffBundle(user) {
  if (!user?.id) return null;
  const { householdId } = await ensureStuffUser(user);

  const [profileResult, preferencesResult, householdResult, membersResult, listResult, invitesResult] = await Promise.all([
    supabase.from('stuff_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('stuff_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    householdId ? supabase.from('stuff_households').select('*').eq('id', householdId).maybeSingle() : Promise.resolve({ data: null }),
    householdId ? supabase.from('stuff_household_members').select('*').eq('household_id', householdId) : Promise.resolve({ data: [] }),
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
    first_name: profile.firstName || null,
    last_name: profile.lastName || null,
    mobile: profile.mobile || null,
    suburb: profile.suburb || null,
    postcode: profile.postcode || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('stuff_profiles').upsert(payload, { onConflict: 'user_id' });
  if (error) throw error;
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
  const { error } = await supabase.from('stuff_preferences').upsert(payload, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function saveStuffHouseholdName(householdId, name) {
  const { error } = await supabase.from('stuff_households').update({ name, updated_at: new Date().toISOString() }).eq('id', householdId);
  if (error) throw error;
}

export async function saveStuffList(householdId, userId, items) {
  const { error } = await supabase.from('stuff_household_lists').upsert({
    household_id: householdId,
    items,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'household_id' });
  if (error) throw error;
}

export async function createStuffInvite(householdId, userId, name, contact) {
  const { data, error } = await supabase.from('stuff_household_invites').insert({
    household_id: householdId,
    invited_by: userId,
    invitee_name: name,
    contact,
  }).select('*').single();
  if (error) throw error;
  return data;
}
