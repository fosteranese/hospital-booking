import { useState, useEffect, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ConfirmAttendanceModal({
  open,
  patientName,
  slotDate,
  startTime,
  endTime,
  attended,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  patientName: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  attended: boolean;
  onConfirm: (minutesLate?: number) => void;
  onCancel: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [minutesLate, setMinutesLate] = useState('');
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setMinutesLate('');
      setConfirming(false);
      const timer = setTimeout(() => {
        if (attended && inputRef.current) {
          inputRef.current.focus();
        } else if (confirmBtnRef.current) {
          confirmBtnRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [open, attended]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, onCancel]);

  if (!open) return null;

  const actionLabel = attended ? 'Attended' : 'Missed';
  const actionColor = attended ? 'emerald' : 'red';
  const Icon = attended ? CheckmarkCircle01Icon : Cancel01Icon;

  const handleConfirm = async () => {
    setConfirming(true);
    const mins = attended && minutesLate ? parseInt(minutesLate, 10) : undefined;
    onConfirm(mins && !isNaN(mins) ? mins : undefined);
  };

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-all duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ backgroundColor: visible ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)' }}
      onMouseDown={e => { if (e.target === e.currentTarget && !confirming) onCancel(); }}
    >
      <div
        className={`w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${
          visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        <div className="px-6 pt-6 pb-2 text-center">
          <div className={`mx-auto size-12 rounded-full flex items-center justify-center mb-4 ${
            actionColor === 'emerald' ? 'bg-emerald-100' : 'bg-red-100'
          }`}>
            <HugeiconsIcon icon={Icon} className={`size-6 ${
              actionColor === 'emerald' ? 'text-emerald-600' : 'text-red-500'
            }`} strokeWidth={2} />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Confirm Attendance</h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Mark <span className="font-semibold text-slate-700">{patientName}</span> as{' '}
            <span className={`font-semibold ${
              actionColor === 'emerald' ? 'text-emerald-600' : 'text-red-500'
            }`}>{actionLabel}</span>?
          </p>
          <p className="text-xs text-slate-400 mt-1.5">
            {formatDate(slotDate)} · {formatTime(startTime)} — {formatTime(endTime)}
          </p>
        </div>

        {attended && (
          <div className="px-6 pt-4">
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">
              Minutes late <span className="text-slate-300 font-normal">(optional)</span>
            </label>
            <input
              ref={inputRef}
              type="number"
              min="0"
              max="999"
              placeholder="0"
              value={minutesLate}
              onChange={e => setMinutesLate(e.target.value)}
              className="w-full h-10 px-3.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
            />
          </div>
        )}

        <div className="flex gap-3 px-6 pt-5 pb-6">
          <button
            onClick={onCancel}
            disabled={confirming}
            className="flex-1 h-11 text-sm font-semibold text-slate-600 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all"
          >
            Cancel
          </button>
          <button
            ref={confirmBtnRef}
            onClick={handleConfirm}
            disabled={confirming}
            className={`flex-1 h-11 text-sm font-semibold text-white rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 ${
              actionColor === 'emerald'
                ? 'bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400'
                : 'bg-red-500 hover:bg-red-600 disabled:bg-red-400'
            }`}
          >
            {confirming ? (
              <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              `Yes, ${actionLabel}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
