import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { tokenStore } from '@/lib/api';

interface AuthState {
  token: string;
  userRole: string;
  otpIdentifier: string;
}

interface AuthContextValue extends AuthState {
  setToken: (t: string) => void;
  setUserRole: (r: string) => void;
  setOtpIdentifier: (id: string) => void;
  clearAuth: () => void;
  setAll: (token: string, role: string, identifier: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY_TOKEN = 'auth_token';
const STORAGE_KEY_ROLE = 'auth_role';
const STORAGE_KEY_ID = 'auth_identifier';

function loadFromStorage(): AuthState {
  try {
    return {
      token: sessionStorage.getItem(STORAGE_KEY_TOKEN) || '',
      userRole: sessionStorage.getItem(STORAGE_KEY_ROLE) || '',
      otpIdentifier: sessionStorage.getItem(STORAGE_KEY_ID) || '',
    };
  } catch {
    return { token: '', userRole: '', otpIdentifier: '' };
  }
}

function saveToStorage(state: AuthState) {
  try {
    sessionStorage.setItem(STORAGE_KEY_TOKEN, state.token || '');
    sessionStorage.setItem(STORAGE_KEY_ROLE, state.userRole || '');
    sessionStorage.setItem(STORAGE_KEY_ID, state.otpIdentifier || '');
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadFromStorage);

  useEffect(() => {
    saveToStorage(state);
    if (state.token) {
      tokenStore.set(state.token);
    } else {
      tokenStore.clear();
    }
  }, [state]);

  const setToken = useCallback((t: string) => {
    setState(prev => ({ ...prev, token: t }));
  }, []);

  const setUserRole = useCallback((r: string) => {
    setState(prev => ({ ...prev, userRole: r }));
  }, []);

  const setOtpIdentifier = useCallback((id: string) => {
    setState(prev => ({ ...prev, otpIdentifier: id }));
  }, []);

  const clearAuth = useCallback(() => {
    setState({ token: '', userRole: '', otpIdentifier: '' });
  }, []);

  const setAll = useCallback((t: string, role: string, identifier: string) => {
    setState({ token: t, userRole: role, otpIdentifier: identifier });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, setToken, setUserRole, setOtpIdentifier, clearAuth, setAll }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
