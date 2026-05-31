import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';

interface ClinicConfig {
  clinicName: string;
  clinicAddress: string;
  minAdvanceDays: number;
}

interface ClinicContextValue extends ClinicConfig {}

const ClinicContext = createContext<ClinicContextValue | null>(null);

const STORAGE_KEY = 'clinic_config';

function loadCached(): ClinicConfig | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ClinicConfig;
  } catch {
    return null;
  }
}

function cacheConfig(config: ClinicConfig) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ClinicConfig>(() => loadCached() || {
    clinicName: '',
    clinicAddress: '',
    minAdvanceDays: 1,
  });

  useEffect(() => {
    if (config.clinicName) return;
    api.getAppointmentConfig().then((settings) => {
      const map: Record<string, string> = {};
      settings.forEach((s: any) => { map[s.name] = s.value; });
      const cfg: ClinicConfig = {
        clinicName: map.clinic_name || 'Clinic',
        clinicAddress: map.clinic_address || '',
        minAdvanceDays: parseInt(map.min_advance_days || '1', 10),
      };
      setConfig(cfg);
      cacheConfig(cfg);
    }).catch(() => {});
  }, []);

  return (
    <ClinicContext.Provider value={config}>
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic(): ClinicContextValue {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error('useClinic must be used within a ClinicProvider');
  return ctx;
}
