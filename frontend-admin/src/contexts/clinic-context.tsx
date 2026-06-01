import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';

interface ClinicConfig {
  clinicName: string;
  clinicAddress: string;
  minAdvanceDays: number;
}

const ClinicContext = createContext<ClinicConfig | null>(null);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ClinicConfig>({
    clinicName: 'Clinic',
    clinicAddress: '',
    minAdvanceDays: 1,
  });

  useEffect(() => {
    api.getSettingsGroup('appointment').then((settings) => {
      const map: Record<string, string> = {};
      settings.forEach((s) => { map[s.name] = s.value; });
      setConfig({
        clinicName: map.clinic_name || 'Clinic',
        clinicAddress: map.clinic_address || '',
        minAdvanceDays: parseInt(map.min_advance_days || '1', 10),
      });
    }).catch(() => {});
  }, []);

  return (
    <ClinicContext.Provider value={config}>
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic(): ClinicConfig {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error('useClinic must be used within a ClinicProvider');
  return ctx;
}
