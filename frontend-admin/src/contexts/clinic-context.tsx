import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';

interface ClinicConfig {
  clinicName: string;
  clinicAddress: string;
  clinicLocationUrl: string;
  minAdvanceDays: number;
}

const ClinicContext = createContext<ClinicConfig | null>(null);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ClinicConfig>({
    clinicName: 'Clinic',
    clinicAddress: '',
    clinicLocationUrl: '',
    minAdvanceDays: 1,
  });

  useEffect(() => {
    Promise.all([
      api.getSettingsGroup('appointment'),
      api.getSettingsGroup('clinic').catch(() => [] as any[]),
    ]).then(([appt, clinic]) => {
      const map: Record<string, string> = {};
      appt.forEach((s: any) => { map[s.name] = s.value; });
      clinic.forEach((s: any) => { map[s.name] = s.value; });
      setConfig({
        clinicName: map.clinic_name || 'Clinic',
        clinicAddress: map.clinic_address || '',
        clinicLocationUrl: map.clinic_location_url || '',
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
