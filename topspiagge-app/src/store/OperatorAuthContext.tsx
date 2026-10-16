import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { safeGetItem, safeRemoveItem, safeSetItem } from '../utils/safeStorage';

const STORAGE_KEY = 'topspiagge_operator_logged_in';

interface OperatorAuthValue {
  isLoggedIn: boolean;
  isHydrating: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const OperatorAuthContext = createContext<OperatorAuthValue | null>(null);

// Real accounts (Supabase Auth email/password) once a beach's Supabase project is configured,
// which beach_id an operator's queries are scoped to per supabase/schema.sql's RLS. Falls back
// to the original hardcoded admin/admin demo gate when Supabase isn't configured (local dev
// without a .env, or the Claude Artifact preview, whose CSP blocks all outbound network calls) --
// same fallback pattern as StoreContext.tsx.
export const OperatorAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        setIsLoggedIn(!!data.session);
        setIsHydrating(false);
      });
      const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsLoggedIn(!!session);
      });
      return () => subscription.subscription.unsubscribe();
    }
    safeGetItem(STORAGE_KEY)
      .then((value) => setIsLoggedIn(value === 'true'))
      .finally(() => setIsHydrating(false));
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return !error;
    }
    const ok = email.trim() === 'admin' && password === 'admin';
    if (ok) {
      setIsLoggedIn(true);
      safeSetItem(STORAGE_KEY, 'true');
    }
    return ok;
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
      return;
    }
    setIsLoggedIn(false);
    safeRemoveItem(STORAGE_KEY);
  };

  const value = useMemo(() => ({ isLoggedIn, isHydrating, login, logout }), [isLoggedIn, isHydrating]);
  return <OperatorAuthContext.Provider value={value}>{children}</OperatorAuthContext.Provider>;
};

export function useOperatorAuth(): OperatorAuthValue {
  const ctx = useContext(OperatorAuthContext);
  if (!ctx) throw new Error('useOperatorAuth must be used within OperatorAuthProvider');
  return ctx;
}
