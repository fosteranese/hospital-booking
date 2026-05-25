import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, Doctor } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface DoctorSelectProps {
  onSelect: (doctorId: string | null, doctorName?: string) => void;
  excludeDoctorId?: string;
}

export function DoctorSelect({ onSelect, excludeDoctorId }: DoctorSelectProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDoctors()
      .then(setDoctors)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = excludeDoctorId ? doctors.filter((d) => d.id !== excludeDoctorId) : doctors;

  return (
    <Card className="w-full max-w-lg mx-auto bg-transparent ring-0 shadow-none overflow-visible">
      <CardHeader className="px-0">
        <CardTitle className="text-foreground">Select a Doctor</CardTitle>
        <CardDescription>
          {excludeDoctorId ? 'Choose a new doctor' : 'Choose a doctor or let us auto-assign'}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-3">
        <div className="space-y-2">
          {!excludeDoctorId && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
            >
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4 px-4 hover:border-primary/50 hover:bg-primary/5 transition-all bg-white/80"
                onClick={() => onSelect(null)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="border-2 border-dashed border-muted-foreground/30">
                    <AvatarFallback className="bg-transparent text-muted-foreground">AU</AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="font-medium text-base">Auto-assign</p>
                    <p className="text-sm text-muted-foreground">Let us pick the best available doctor</p>
                  </div>
                </div>
              </Button>
            </motion.div>
          )}

          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <motion.div
                key={`skel-${i}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <div className="w-full flex items-center gap-3 py-4 px-4 rounded-4xl bg-white/50 mb-2">
                  <div className="size-12 rounded-full bg-muted animate-skeleton shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-2/3 rounded-md bg-muted animate-skeleton" />
                    <div className="h-3 w-1/3 rounded-md bg-muted animate-skeleton" />
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            filtered.map((doc, i) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-4 px-4 hover:border-primary/50 hover:bg-primary/5 transition-all bg-white/80"
                  onClick={() => onSelect(doc.id, `Dr. ${doc.first_name} ${doc.last_name} (${doc.specialization})`)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="border-2 border-primary/10">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {doc.first_name[0]}{doc.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="font-medium text-base">Dr. {doc.first_name} {doc.last_name}</p>
                      <p className="text-sm text-muted-foreground">{doc.specialization}</p>
                    </div>
                  </div>
                </Button>
              </motion.div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
