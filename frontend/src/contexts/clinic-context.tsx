import { createContext, useContext, type ReactNode } from 'react';

interface ClinicConfig {
  clinicName: string;
  clinicAddress: string;
  minAdvanceDays: number;
}

const ClinicContext = createContext<ClinicConfig | null>(null);

export function ClinicProvider({ children, config }: { children: ReactNode; config: ClinicConfig }) {
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
