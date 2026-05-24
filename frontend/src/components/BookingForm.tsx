import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api, TimeSlot } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface BookingFormProps {
  doctorId: string | null;
  defaultDate?: string;
  patientId?: string;
  onSelectSlot: (slotId: string, date: string, startTime: string, doctorId?: string) => void;
}

function SlotSkeleton() {
  return (
    <div className="h-[52px] rounded-4xl bg-muted animate-skeleton" />
  );
}

export function BookingForm({ doctorId, defaultDate = '', patientId, onSelectSlot }: BookingFormProps) {
  const [date, setDate] = useState(defaultDate);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    setSelectedSlot(null);
    const fetch = doctorId
      ? api.getAvailability(doctorId, date, patientId)
      : api.getAllAvailability(date, patientId);
    fetch
      .then(setSlots)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date, doctorId, patientId]);

  const handleConfirm = () => {
    if (!selectedSlot) return;
    const slot = slots.find(s => s.id === selectedSlot);
    if (slot && !slot.is_booked && !slot.is_blocked) onSelectSlot(slot.id, slot.slot_date, slot.start_time, slot.doctor_id);
  };

  const availableSlots = slots.filter(s => !s.is_booked && !s.is_blocked);
  const unavailableSlots = slots.filter(s => s.is_booked || s.is_blocked);

  return (
    <Card className="w-full max-w-lg mx-auto bg-transparent ring-0 shadow-none overflow-visible">
      <CardHeader className="px-0">
        <CardTitle className="text-foreground">{doctorId ? 'Select Date & Time' : 'Select Date & Time (All Doctors)'}</CardTitle>
      </CardHeader>
      <CardContent className="px-0 space-y-4">
        <Input
          type="date"
          inputSize="xl"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="bg-white"
        />
        {loading && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <SlotSkeleton key={i} />
              ))}
            </div>
          </div>
        )}
        {!loading && date && slots.length === 0 && (
          <CardDescription>No time slots available for this date</CardDescription>
        )}
        {!loading && slots.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {availableSlots.length > 0 && (
              <>
                <Label className="text-xs text-muted-foreground mb-2 block">Available</Label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot.id}
                      variant={selectedSlot === slot.id ? 'default' : 'outline'}
                      size="sm"
                      className={`h-auto py-2 transition-all ${selectedSlot === slot.id ? 'ring-2 ring-primary/30' : 'bg-white/80'}`}
                      onClick={() => setSelectedSlot(slot.id)}
                    >
                      <div className="text-left leading-tight">
                        <div>{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</div>
                        {slot.doctor_name && (
                          <div className="text-[10px] opacity-70">{slot.doctor_name}</div>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              </>
            )}
            {unavailableSlots.length > 0 && (
              <>
                <Label className="text-xs text-muted-foreground mb-2 block">Unavailable</Label>
                <div className="grid grid-cols-2 gap-2">
                  {unavailableSlots.map((slot) => (
                    <Button
                      key={slot.id}
                      variant="outline"
                      size="sm"
                      disabled
                      className="h-auto py-2 border-dashed opacity-50 line-through cursor-not-allowed bg-white/40"
                    >
                      <div className="text-left leading-tight">
                        <div>{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</div>
                        {slot.doctor_name && (
                          <div className="text-[10px] opacity-50">{slot.doctor_name}</div>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
        <Button className="w-full" onClick={handleConfirm} disabled={!selectedSlot}>
          Confirm Time
        </Button>
      </CardContent>
    </Card>
  );
}
