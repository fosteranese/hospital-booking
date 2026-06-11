import { AppointmentHistoryItem } from './api';

/* ── Time / Date formatting ── */

export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

/** "2025-06-11" -> "Wed, Jun 11, 2025" */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "2025-06-11" -> "Wed, Jun 11" (no year) */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/* ── Patient avatar initials circle ── */

export function PatientAvatar({ name }: { name: string }) {
  const initials = (name || 'P')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  return (
    <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-[11px] font-semibold text-slate-600">
      {initials}
    </div>
  );
}

/* ── Effective status logic ── */

export function getEffectiveStatus(
  a: AppointmentHistoryItem
): 'attended' | 'missed' | 'confirmed' | 'cancelled' {
  if (a.status === 'cancelled') return 'cancelled';
  if (a.attended === true) return 'attended';
  if (a.attended === false) return 'missed';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const apptDate = new Date(a.slot_date + 'T00:00:00');
  if (apptDate < today) return 'missed';
  const [h, m] = a.end_time.split(':').map(Number);
  const slotEnd = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    h,
    m
  );
  if (new Date() >= slotEnd) return 'missed';
  return 'confirmed';
}

/* ── Date helpers ── */

export function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isBeforeToday(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr + 'T00:00:00') < today;
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function getWeekRange(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

/* ── Shared CSS strings ── */

export const inputClass =
  'h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all';

export const selectClass =
  'h-8 px-2.5 text-xs border border-slate-200 rounded-md bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer';
