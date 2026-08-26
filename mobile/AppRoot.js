import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StuffApp from './StuffApp';
import { AuthProvider, useStuffAuth } from './AuthContext';
import { acceptStuffInvite } from './stuffData';

const PENDING_INVITE_KEY = 'stuff.pending-household-invite';

function inviteCodeFromUrl(url) {
  const value = String(url || '');
  const match = value.match(/[?&]code=([^&#]+)/i);
  if (!match) return null;
  try { return decodeURIComponent(match[1]).trim().toUpperCase(); }
  catch (_) { return match[1].trim().toUpperCase(); }
}

function StuffRootInner() {
  const { user, loading } = useStuffAuth();
  const [appKey, setAppKey] = useState(0);
  const [pendingInvite, setPendingInvite] = useState(null);
  const guestPrompted = useRef(false);

  useEffect(() => {
    let mounted = true;

    const capture = async url => {
      const code = inviteCodeFromUrl(url);
      if (!code) return;
      await AsyncStorage.setItem(PENDING_INVITE_KEY, code);
      if (mounted) {
        guestPrompted.current = false;
        setPendingInvite(code);
      }
    };

    AsyncStorage.getItem(PENDING_INVITE_KEY).then(code => {
      if (mounted && code) setPendingInvite(code);
    }).catch(() => {});

    Linking.getInitialURL().then(capture).catch(() => {});
    const subscription = Linking.addEventListener('url', event => capture(event.url));

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (loading || !pendingInvite) return;

    if (!user) {
      if (!guestPrompted.current) {
        guestPrompted.current = true;
        Alert.alert(
          'Household invite saved',
          'Open Account and sign in or create a Stuff account. We’ll join the household automatically after you sign in.'
        );
      }
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await acceptStuffInvite(pendingInvite);
        await AsyncStorage.removeItem(PENDING_INVITE_KEY);
        if (cancelled) return;
        setPendingInvite(null);
        setAppKey(value => value + 1);
        Alert.alert('Household joined', 'You’re now using the shared household shopping list.');
      } catch (error) {
        if (cancelled) return;
        await AsyncStorage.removeItem(PENDING_INVITE_KEY).catch(() => {});
        setPendingInvite(null);
        Alert.alert('Could not join household', error?.message || 'The invite may be invalid or expired.');
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, loading, pendingInvite]);

  return <StuffApp key={`stuff-${appKey}`} />;
}

export default function AppRoot() {
  return <AuthProvider><StuffRootInner /></AuthProvider>;
}
