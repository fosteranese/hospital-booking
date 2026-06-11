import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

interface Appointment {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: string;
  attended: boolean | null;
  notes?: string;
  doctor_name: string;
}

interface CalendarProps {
  appointments: Appointment[];
  onDateClick?: (date: string) => void;
  selectedDate?: string | null;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function Calendar({ appointments, onDateClick, selectedDate }: CalendarProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  // Group appointments by date
  const appointmentsByDate = appointments.reduce((acc, appt) => {
    if (!acc[appt.slot_date]) {
      acc[appt.slot_date] = [];
    }
    acc[appt.slot_date].push(appt);
    return acc;
  }, {} as Record<string, Appointment[]>);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Build calendar grid
  const calendarDays: (number | null)[] = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-muted">
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Previous month"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5 text-muted-foreground" />
          </button>
          <h2 className="text-lg font-semibold text-foreground">
            {monthNames[currentMonth]} {currentYear}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Next month"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 text-muted-foreground" />
          </button>
        </div>
      </div>
      
      {/* Day names */}
      <div className="grid grid-cols-7 border-b border-border">
        {dayNames.map((day) => (
          <div
            key={day}
            className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground uppercase"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="min-h-[100px] border-b border-r border-border bg-muted/50" />;
          }

          const dateKey = formatDateKey(currentYear, currentMonth, day);
          const dayAppointments = appointmentsByDate[dateKey] || [];
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;
          const hasAppointments = dayAppointments.length > 0;

          return (
            <div
              key={dateKey}
              onClick={() => onDateClick?.(dateKey)}
              className={`
                min-h-[100px] p-2 border-b border-r border-border cursor-pointer
                transition-colors hover:bg-muted
                ${isSelected ? 'bg-emerald-50' : ''}
              `}
            >
              <div className="flex items-start justify-between mb-1">
                <span
                  className={`
                    inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium
                    ${isToday ? 'bg-emerald-600 text-white' : 'text-foreground'}
                  `}
                >
                  {day}
                </span>
                {hasAppointments && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                    {dayAppointments.length}
                  </span>
                )}
              </div>
              
              {/* Appointment indicators */}
              {hasAppointments && (
                <div className="space-y-1 mt-1">
                  {dayAppointments.slice(0, 2).map((appt) => (
                    <div
                      key={appt.id}
                      className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded truncate"
                      title={`${formatTime(appt.start_time)} - ${formatTime(appt.end_time)}`}
                    >
                      {formatTime(appt.start_time)}
                    </div>
                  ))}
                  {dayAppointments.length > 2 && (
                    <div className="text-xs text-slate-500 px-1.5">
                      +{dayAppointments.length - 2} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}
