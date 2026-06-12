import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Scheduler, type CalendarEvent as CKEvent } from 'calendarkit-pro';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { useCachedData } from '@/hooks/useCachedData';


import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { UnavailabilityConflictBanner } from '@/components/UnavailabilityConflictBanner';
import { Card } from '@/components/Card';

import { EventDetailModal } from '@/components/EventDetailModal';
import { RescheduleConfirmModal } from '@/components/RescheduleConfirmModal';
import { CreateAppointmentModal } from '@/components/CreateAppointmentModal';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar01Icon, AlertCircleIcon,
  FilterIcon,
} from '@hugeicons/core-free-icons';
import { isBeforeToday } from '@/lib/helpers';

const STATUS_COLORS: Record<string, string> = {
  attended: '#10b981',
  missed: '#9333ea',
  confirmed: '#f59e0b',
  cancelled: '#94a3b8',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
];


function appointmentStatusColor(appt: AppointmentHistoryItem): string {
  if (appt.status === 'cancelled') return STATUS_COLORS.cancelled;
  if (appt.attended === true) return STATUS_COLORS.attended;
  if (appt.attended === false || isBeforeToday(appt.slot_date)) return STATUS_COLORS.missed;
  return STATUS_COLORS.confirmed;
}

function parseDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

function toCKEvent(appt: AppointmentHistoryItem): CKEvent {
  const color = appointmentStatusColor(appt);
  return {
    id: appt.id,
    title: appt.patient_name,
    start: parseDateTime(appt.slot_date, appt.start_time),
    end: parseDateTime(appt.slot_date, appt.end_time),
    color,
    description: appt.notes || '',
    status: appt.status,
    attended: appt.attended,
    doctor_name: appt.doctor_name,
    patient_name: appt.patient_name,
    patient_id: appt.patient_id,
    doctor_id: appt.doctor_id,
    specialization: appt.specialization,
    cancellation_reason: appt.cancellation_reason,
    start_time: appt.start_time,
    end_time: appt.end_time,
    slot_date: appt.slot_date,
  };
}

export function CalendarPage() {
  const { token, userRole } = useAuth();
  const isDoctor = userRole === 'doctor';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day'>('week');

  const [statusFilter, setStatusFilter] = useState('');

  const [selectedEvent, setSelectedEvent] = useState<CKEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [reschedEvent, setReschedEvent] = useState<{ event: CKEvent; newStart: Date; newEnd: Date } | null>(null);
  const [reschedOpen, setReschedOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);

  const schedulerCloseRef = useRef<(() => void) | null>(null);
  const schedulerHandledRef = useRef(false);

  const dateRange = useMemo(() => {
    const d = currentDate;
    if (currentView === 'month') {
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      return { from: format(start, 'yyyy-MM-dd'), to: format(end, 'yyyy-MM-dd') };
    } else if (currentView === 'week') {
      const start = startOfWeek(d, { weekStartsOn: 0 });
      const end = endOfWeek(d, { weekStartsOn: 0 });
      return { from: format(start, 'yyyy-MM-dd'), to: format(end, 'yyyy-MM-dd') };
    }
    const day = format(d, 'yyyy-MM-dd');
    return { from: day, to: day };
  }, [currentDate, currentView]);

  const cacheKey = `appointments:calendar:${statusFilter || 'all'}:${dateRange.from}:${dateRange.to}`;

  const { data: rawAppointments, loading, error, refresh: fetchAppointments, backgroundRefresh } = useCachedData(
    cacheKey,
    useCallback(() => api.listAppointments({ status: statusFilter || undefined, from: dateRange.from, to: dateRange.to }, token), [token, statusFilter, dateRange.from, dateRange.to]),
    { enabled: !!token }
  );
  const appointments = rawAppointments ?? [];

  const refreshAll = useCallback(async () => {
    await backgroundRefresh();
  }, [backgroundRefresh]);

  const events = useMemo(() => appointments.map(toCKEvent), [appointments]);

  const handleEventClick = (event: CKEvent) => {
    setSelectedEvent(event);
    setDetailOpen(true);
  };

  const handleEventDrop = (event: CKEvent, start: Date, end: Date) => {
    setReschedEvent({ event, newStart: start, newEnd: end });
    setReschedOpen(true);
  };

  const confirmReschedule = async (reason?: string) => {
    if (!reschedEvent) return;
    const { event, newStart, newEnd } = reschedEvent;
    const slotDate = format(newStart, 'yyyy-MM-dd');
    const startTime = format(newStart, 'HH:mm');
    const endTime = format(newEnd, 'HH:mm');

    await api.rescheduleAppointmentToTime(event.id, {
      slot_date: slotDate,
      start_time: startTime,
      end_time: endTime,
      reason,
    }, token);

    setReschedOpen(false);
    setReschedEvent(null);
    await refreshAll();
  };

  const handleUpdateEvent = async (data: { attended?: boolean | null; notes?: string }) => {
    if (!selectedEvent) return;
    if (data.notes !== undefined) {
      await api.updateAppointment(selectedEvent.id, { notes: data.notes }, token);
    }
    if (data.attended !== selectedEvent.attended && data.attended !== undefined && data.attended !== null) {
      await api.markAttendance(selectedEvent.id, { attended: data.attended }, token);
    }
    await refreshAll();
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    await api.cancelAppointment(selectedEvent.id, { cancellation_reason: 'Cancelled by staff' }, token);
    setDetailOpen(false);
    setSelectedEvent(null);
    await refreshAll();
  };

  const handleCreateAppointment = async (data: {
    patient_id: string; doctor_id: string; slot_date: string;
    start_time: string; end_time: string; notes?: string;
  }) => {
    await api.createAppointment(data, token);
    await refreshAll();
  };

  const eventsWithModified = useMemo(() => events.map(ev => {
    const parts = [
      ev.doctor_name ? `Doctor: ${ev.doctor_name}` : '',
      ev.specialization ? `${ev.specialization}` : '',
      ev.status ? `Status: ${ev.status}` : '',
      ev.attended === true ? '✓ Attended' : ev.attended === false ? '✗ Missed' : '',
    ].filter(Boolean);
    if (ev.description) parts.push(ev.description);
    return { ...ev, description: parts.join('\n') };
  }), [events]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="View and manage appointments"
        icon={Calendar01Icon}
      />

      <UnavailabilityConflictBanner />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={refreshAll} className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-card shadow-sm hover:bg-muted transition-all" title="Refresh data">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4 text-muted-foreground">
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
          <HugeiconsIcon icon={FilterIcon} className="size-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <Scheduler
          events={eventsWithModified}
          date={currentDate}
          onDateChange={setCurrentDate}
          view={currentView}
          onViewChange={(v) => setCurrentView(v as 'month' | 'week' | 'day')}
          onEventClick={handleEventClick}
          onEventDrop={handleEventDrop}
          hideViewSwitcher={false}
          isLoading={loading}
          renderEventForm={({ isOpen, onClose, event, initialDate, onSave, onDelete }) => {
            if (isOpen && !schedulerHandledRef.current) {
              schedulerHandledRef.current = true;
              schedulerCloseRef.current = onClose;
              setTimeout(() => {
                if (event) {
                  setSelectedEvent(event);
                  setDetailOpen(true);
                } else if (initialDate) {
                  setCurrentDate(initialDate);
                  setCreateOpen(true);
                }
              }, 0);
            } else if (!isOpen) {
              schedulerHandledRef.current = false;
              schedulerCloseRef.current = null;
            }
            return null;
          }}
        />
      </Card>

      <EventDetailModal
        event={selectedEvent ? {
          id: selectedEvent.id,
          patient_name: selectedEvent.patient_name as string || '',
          doctor_name: selectedEvent.doctor_name as string || '',
          specialization: selectedEvent.specialization as string || '',
          start: selectedEvent.start,
          end: selectedEvent.end,
          status: selectedEvent.status as string || 'confirmed',
          attended: selectedEvent.attended as boolean | null ?? null,
          notes: selectedEvent.description || '',
          cancellation_reason: selectedEvent.cancellation_reason as string || '',
        } : null}
        open={detailOpen}
        onClose={() => { schedulerCloseRef.current?.(); schedulerCloseRef.current = null; setDetailOpen(false); setSelectedEvent(null); }}
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
      />

      <RescheduleConfirmModal
        open={reschedOpen}
        onClose={() => { setReschedOpen(false); setReschedEvent(null); }}
        onConfirm={confirmReschedule}
        patientName={reschedEvent?.event.patient_name as string || ''}
        oldStart={reschedEvent?.event.start || new Date()}
        oldEnd={reschedEvent?.event.end || new Date()}
        newStart={reschedEvent?.newStart || new Date()}
        newEnd={reschedEvent?.newEnd || new Date()}
      />

      <CreateAppointmentModal
        open={createOpen}
        onClose={() => { schedulerCloseRef.current?.(); schedulerCloseRef.current = null; setCreateOpen(false); }}
        onCreate={handleCreateAppointment}
        selectedDate={currentDate}
        token={token}
      />
    </div>
  );
}
