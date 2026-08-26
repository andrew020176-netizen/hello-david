import { Share } from 'react-native';
import { supabase } from './supabase';

function throwIfError(result) {
  if (result?.error) throw result.error;
  return result?.data;
}

export async function ensureStuffUser(user) {
  if (!user?.id) return { householdId: null };

  throwIfError(await supabase.from('stuff_profiles').upsert({ user_id: user.id }, { onConflict: 'user_id' }));
  throwIfError(await supabase.from('stuff_preferences').upsert({ user_id: user.id }, { onConflict: 'user_id' }));

  const profileResult = await supabase
    .from('stuff_profiles')
    .select('active_household_id')
    .eq('user_id', user.id)
    .maybeSingle();
  throwIfError(profileResult);

  const activeHouseholdId = profileResult.data?.active_household_id;
  if (activeHouseholdId) {
    const activeMembershipResult = await supabase
      .from('stuff_household_members')
      .select('household_id')
      .eq('household_id', activeHouseholdId)
      .eq('user_id', user.id)
      .maybeSingle();
    throwIfError(activeMembershipResult);
    if (activeMembershipResult.data?.household_id) return { householdId: activeHouseholdId };
  }

  const existingResult = await supabase
    .from('stuff_household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  throwIfError(existingResult);

  if (existingResult.data?.household_id) {
    const householdId = existingResult.data.household_id;
    throwIfError(await supabase
      .from('stuff_profiles')
      .update({ active_household_id: householdId, updated_at: new Date().toISOString() })
      .eq('user_id', user.id));
    return { householdId };
  }

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

  throwIfError(await supabase
    .from('stuff_profiles')
    .update({ active_household_id: householdId, updated_at: new Date().toISOString() })
    .eq('user_id', user.id));

  return { householdId };
}

export async function loadStuffBundle(user) {
  if (!user?.id) return null;
  const { householdId } = await ensureStuffUser(user);

  const [profileResult, preferencesResult, householdResult, membersResult, listResult, invitesResult, productMemoryResult] = await Promise.all([
    supabase.from('stuff_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('stuff_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    householdId ? supabase.from('stuff_households').select('*').eq('id', householdId).maybeSingle() : Promise.resolve({ data: null }),
    householdId ? supabase.from('stuff_household_members').select('*').eq('household_id', householdId).order('joined_at', { ascending: true }) : Promise.resolve({ data: [] }),
    householdId ? supabase.from('stuff_household_lists').select('*').eq('household_id', householdId).maybeSingle() : Promise.resolve({ data: null }),
    householdId ? supabase.from('stuff_household_invites').select('*').eq('household_id', householdId).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    householdId ? supabase.from('stuff_household_product_memory').select('*').eq('household_id', householdId).order('last_used_at', { ascending: false }) : Promise.resolve({ data: [] }),
  ]);

  const firstError = [profileResult, preferencesResult, householdResult, membersResult, listResult, invitesResult, productMemoryResult].find(r => r?.error)?.error;
  if (firstError) throw firstError;

  return {
    householdId,
    profile: profileResult.data,
    preferences: preferencesResult.data,
    household: householdResult.data,
    members: membersResult.data || [],
    list: listResult.data,
    invites: invitesResult.data || [],
    productMemory: productMemoryResult.data || [],
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
    preferred_supermarket: preferences.preferredSupermarket === 'coles' ? 'coles' : 'woolworths',
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
  const invite = throwIfError(result);

  if (invite?.invite_code) {
    const link = `stuffshopping://join?code=${encodeURIComponent(invite.invite_code)}`;
    try {
      await Share.share({
        message: `Join my Stuff the Shopping household.\n\nInvite code: ${invite.invite_code}\n\nOpen the invite: ${link}`,
      });
    } catch (_) {}
  }

  return invite;
}

export async function acceptStuffInvite(inviteCode) {
  const code = String(inviteCode || '').trim().toUpperCase();
  if (!code) throw new Error('Enter an invite code.');
  const result = await supabase.rpc('accept_stuff_household_invite_code', { code });
  const householdId = throwIfError(result);
  return householdId;
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


export async function createStuffSupportRequest(userId, email, message, category='support') {
  const clean=String(message||'').trim();
  if(!userId)throw new Error('Sign in to contact support.');
  if(!clean)throw new Error('Tell us what happened first.');
  const result=await supabase.from('stuff_support_requests').insert({
    user_id:userId,
    email:String(email||'').trim()||null,
    category,
    message:clean.slice(0,5000),
    app_version:'0.1.0',
  }).select('id').single();
  return throwIfError(result);
}


function stuffMemoryKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(on special|cheapest|best value|value option)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function rememberStuffHouseholdProduct(householdId, retailer, selection) {
  if (!householdId || !selection?.request || !selection?.productId) return null;
  const requestKey = stuffMemoryKey(selection.request);
  if (!requestKey) return null;
  const rpcResult = await supabase.rpc('remember_stuff_household_product', {
    p_household_id: householdId,
    p_retailer: retailer === 'coles' ? 'coles' : 'woolworths',
    p_request_key: requestKey,
    p_product_id: String(selection.productId),
    p_product_name: String(selection.productName || selection.product || '').trim() || null,
    p_brand: String(selection.brand || '').trim() || null,
    p_size: String(selection.size || '').trim() || null,
  });
  throwIfError(rpcResult);
  const rowResult = await supabase
    .from('stuff_household_product_memory')
    .select('*')
    .eq('household_id', householdId)
    .eq('retailer', retailer === 'coles' ? 'coles' : 'woolworths')
    .eq('request_key', requestKey)
    .maybeSingle();
  return throwIfError(rowResult);
}

export async function forgetStuffHouseholdProduct(householdId, retailer, requestKey) {
  if (!householdId) return;
  throwIfError(await supabase
    .from('stuff_household_product_memory')
    .delete()
    .eq('household_id', householdId)
    .eq('retailer', retailer)
    .eq('request_key', String(requestKey || '').trim().toLowerCase()));
}

export async function clearStuffHouseholdProductMemory(householdId) {
  if (!householdId) return;
  throwIfError(await supabase
    .from('stuff_household_product_memory')
    .delete()
    .eq('household_id', householdId));
}
