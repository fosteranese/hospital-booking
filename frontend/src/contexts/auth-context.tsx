import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
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

export function AuthProvider({ children, initialToken, initialRole, initialIdentifier }: {
  children: ReactNode;
  initialToken: string;
  initialRole: string;
  initialIdentifier: string;
}) {
  const [token, _setToken] = useState(initialToken);
  const [userRole, setUserRole] = useState(initialRole);
  const [otpIdentifier, setOtpIdentifier] = useState(initialIdentifier);

  const setToken = useCallback((t: string) => {
    _setToken(t);
    tokenStore.set(t);
  }, []);

  const clearAuth = useCallback(() => {
    _setToken('');
    setUserRole('');
    setOtpIdentifier('');
    tokenStore.clear();
  }, []);

  const setAll = useCallback((t: string, role: string, identifier: string) => {
    _setToken(t);
    tokenStore.set(t);
    setUserRole(role);
    setOtpIdentifier(identifier);
  }, []);

  return (
    <AuthContext.Provider value={{ token, userRole, otpIdentifier, setToken, setUserRole, setOtpIdentifier, clearAuth, setAll }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
