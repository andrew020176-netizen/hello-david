import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null, needsEmailConfirmation: false }),
  signOut: async () => ({ error: null }),
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data?.session || null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    loading,
    async signIn(email, password) {
      const result = await supabase.auth.signInWithPassword({ email: String(email || '').trim(), password });
      return { error: result.error || null };
    },
    async signUp(email, password) {
      const result = await supabase.auth.signUp({ email: String(email || '').trim(), password });
      return { error: result.error || null, needsEmailConfirmation: !result.data?.session };
    },
    async signOut() {
      const result = await supabase.auth.signOut();
      return { error: result.error || null };
    },
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useStuffAuth() {
  return useContext(AuthContext);
}
