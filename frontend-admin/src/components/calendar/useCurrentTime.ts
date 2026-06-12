import { useState, useEffect } from 'react';

export function useCurrentTime(refreshMs = 60_000) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  return now;
}

export function timeToPercent(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return ((h * 60 + m) / (24 * 60)) * 100;
}

export function durationPercent(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  return ((endMin - startMin) / (24 * 60)) * 100;
}

export function getStatusColor(appt: {
  status: string;
  attended: boolean | null;
  slot_date: string;
}): string {
  if (appt.status === 'cancelled') return '#94a3b8';
  if (appt.attended === true) return '#10b981';
  if (appt.attended === false) return '#9333ea';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const apptDate = new Date(appt.slot_date + 'T00:00:00');
  if (apptDate < today) return '#9333ea';
  return '#f59e0b';
}

export const HOUR_HEIGHT = 60;

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const period = i >= 12 ? 'PM' : 'AM';
  const h = i % 12 || 12;
  return `${h}${period}`;
});
export { HOURS };
