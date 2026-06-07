import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { tokenStore, api } from '@/lib/api';

interface AuthState {
  token: string;
  userRole: string;
  otpIdentifier: string;
}

interface AuthContextValue extends AuthState {
  setAll: (token: string, role: string, identifier: string) => void;
  clearAuth: () => void;
  doctorCanCreateAppointments: boolean;
  doctorCanRefer: boolean;
  attendedFollowUpDays: number;
  attendedReferralDays: number;
  missedRescheduleDays: number;
  missedReferralDays: number;
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

function parseBool(settings: Array<{ name: string; value: string | null }>, name: string, defaultVal: boolean): boolean {
  const s = settings.find(s => s.name === name);
  return s ? s.value === 'true' : defaultVal;
}

function parseIntVal(settings: Array<{ name: string; value: string | null }>, name: string, defaultVal: number): number {
  const s = settings.find(s => s.name === name);
  return s ? parseInt(s.value || String(defaultVal), 10) || defaultVal : defaultVal;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadFromStorage);
  const [doctorCanCreateAppointments, setCanCreate] = useState(true);
  const [doctorCanRefer, setCanRefer] = useState(true);
  const [attendedFollowUpDays, setAttendedFollowUpDays] = useState(30);
  const [attendedReferralDays, setAttendedReferralDays] = useState(30);
  const [missedRescheduleDays, setMissedRescheduleDays] = useState(7);
  const [missedReferralDays, setMissedReferralDays] = useState(7);

  useEffect(() => {
    if (!state.token) return;
    api.getSettingsGroup('appointment')
      .then(settings => {
        setCanCreate(parseBool(settings, 'doctor_can_create_appointments', true));
        setCanRefer(parseBool(settings, 'doctor_can_refer', true));
        setAttendedFollowUpDays(parseIntVal(settings, 'attended_follow_up_days', 30));
        setAttendedReferralDays(parseIntVal(settings, 'attended_referral_days', 30));
        setMissedRescheduleDays(parseIntVal(settings, 'missed_reschedule_days', 7));
        setMissedReferralDays(parseIntVal(settings, 'missed_referral_days', 7));
      })
      .catch(() => {});
  }, [state.token]);

  useEffect(() => {
    saveToStorage(state);
    if (state.token) {
      tokenStore.set(state.token);
    } else {
      tokenStore.clear();
    }
  }, [state]);

  const setAll = useCallback((t: string, role: string, identifier: string) => {
    setState({ token: t, userRole: role, otpIdentifier: identifier });
  }, []);

  const clearAuth = useCallback(() => {
    setState({ token: '', userRole: '', otpIdentifier: '' });
    setCanCreate(true);
    setCanRefer(true);
    setAttendedFollowUpDays(30);
    setAttendedReferralDays(30);
    setMissedRescheduleDays(7);
    setMissedReferralDays(7);
  }, []);

  return (
    <AuthContext.Provider value={{
      ...state, setAll, clearAuth,
      doctorCanCreateAppointments, doctorCanRefer,
      attendedFollowUpDays, attendedReferralDays,
      missedRescheduleDays, missedReferralDays,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
