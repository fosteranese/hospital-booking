import { AppointmentHistoryItem } from '@/lib/api';
import { formatTime, getEffectiveStatus } from '@/lib/helpers';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  attended: { label: 'Attended', color: 'bg-emerald-500' },
  missed: { label: 'Missed', color: 'bg-purple-500' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-300' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-500' },
};

export function StatusDot({
  status,
  attended,
  minutes_late,
  start_time,
  end_time,
  arrival_time,
  slot_date,
  has_conflict,
}: {
  status: string;
  attended: boolean | null;
  minutes_late?: number | null;
  start_time?: string;
  end_time?: string;
  arrival_time?: string | null;
  slot_date?: string;
  has_conflict?: boolean;
}) {
  if (has_conflict) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-red-600 font-medium"
        title="Conflict"
      >
        <span className="size-1.5 rounded-full bg-red-600" />
        Conflict
      </span>
    );
  }
  const effective = getEffectiveStatus({
    status,
    attended,
    end_time: end_time ?? '',
    slot_date: slot_date ?? '',
    minutes_late,
  } as AppointmentHistoryItem);
  const s = STATUS_MAP[effective];
  const arrivalDisplay = (() => {
    if (arrival_time) {
      const timePart = arrival_time.split('T')[1]?.slice(0, 5);
      if (timePart) return formatTime(timePart);
    }
    if (attended === true && minutes_late != null && minutes_late > 0 && start_time) {
      const [h, m] = start_time.split(':').map(Number);
      const totalMin = h * 60 + m + minutes_late;
      const newH = Math.floor(totalMin / 60) % 24;
      const newM = totalMin % 60;
      return `${newH % 12 || 12}:${String(newM).padStart(2, '0')} ${
        newH >= 12 ? 'PM' : 'AM'
      }`;
    }
    return null;
  })();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" title={s.label}>
      <span className={`size-1.5 rounded-full ${s.color}`} />
      {s.label}
      {arrivalDisplay && (
        <span className="text-amber-600 font-medium">· arrived {arrivalDisplay}</span>
      )}
    </span>
  );
}
