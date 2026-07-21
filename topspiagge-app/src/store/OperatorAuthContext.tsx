import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { safeGetItem, safeRemoveItem, safeSetItem } from '../utils/safeStorage';

const STORAGE_KEY = 'topspiagge_operator_logged_in';

interface OperatorAuthValue {
  isLoggedIn: boolean;
  isHydrating: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const OperatorAuthContext = createContext<OperatorAuthValue | null>(null);

// Hardcoded admin/admin demo credential, explicitly requested for this prototype's operator
// area. Kept in its own context (separate from the customer app entirely) and persisted so
// staff aren't prompted again on every reload mid-shift, until they explicitly log out.
export const OperatorAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    safeGetItem(STORAGE_KEY)
      .then((value) => setIsLoggedIn(value === 'true'))
      .finally(() => setIsHydrating(false));
  }, []);

  const login = (username: string, password: string): boolean => {
    const ok = username.trim() === 'admin' && password === 'admin';
    if (ok) {
      setIsLoggedIn(true);
      safeSetItem(STORAGE_KEY, 'true');
    }
    return ok;
  };

  const logout = () => {
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
