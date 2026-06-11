import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Loading02Icon } from '@hugeicons/core-free-icons';

interface DetailEvent {
  id: string;
  patient_name: string;
  doctor_name: string;
  specialization: string;
  start: Date;
  end: Date;
  status: string;
  attended: boolean | null;
  notes: string;
  cancellation_reason: string;
}

interface EventDetailModalProps {
  event: DetailEvent | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (data: { attended?: boolean | null; notes?: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700 ring-emerald-200/50',
  pending: 'bg-amber-100 text-amber-700 ring-amber-200/50',
  completed: 'bg-blue-100 text-blue-700 ring-blue-200/50',
  cancelled: 'bg-red-100 text-red-700 ring-red-200/50',
};

export function EventDetailModal({ event, open, onClose, onUpdate, onDelete }: EventDetailModalProps) {
  const [notes, setNotes] = useState('');
  const [attended, setAttended] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    if (event) {
      setNotes(event.notes || '');
      setAttended(event.attended);
      setShowConfirmDelete(false);
    }
  }, [event]);

  if (!open || !event) return null;

  const handleSave = async () => {
    setSaving(true);
    const data: { attended?: boolean | null; notes?: string } = {};
    if (attended !== event.attended) data.attended = attended;
    if (notes !== event.notes) data.notes = notes;
    if (Object.keys(data).length > 0) {
      await onUpdate(data);
    }
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    setShowConfirmDelete(false);
    onClose();
  };

  const hasChanges = attended !== event.attended || notes !== event.notes;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Appointment Details</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground">
            <HugeiconsIcon icon={Cancel01Icon} className="size-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Patient</div>
              <div className="text-sm font-semibold text-foreground">{event.patient_name}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Doctor</div>
              <div className="text-sm font-semibold text-foreground">{event.doctor_name}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Specialization</div>
              <div className="text-sm text-foreground">{event.specialization || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Status</div>
              <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${STATUS_BADGE[event.status] || 'bg-muted text-foreground'}`}>
                {event.status}
              </span>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Date</div>
              <div className="text-sm text-foreground">{format(event.start, 'EEEE, MMM d, yyyy')}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Time</div>
              <div className="text-sm text-foreground">{format(event.start, 'h:mm a')} — {format(event.end, 'h:mm a')}</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Attendance</div>
            {(() => {
              const now = new Date();
              const isToday = now.getFullYear() === event.start.getFullYear() && now.getMonth() === event.start.getMonth() && now.getDate() === event.start.getDate();
              return isToday ? (
              <div className="flex gap-2">
                {[true, false, null].map((val) => {
                  const label = val === true ? 'Attended' : val === false ? 'Missed' : 'Unmarked';
                  const active = attended === val;
                  return (
                    <button
                      key={String(val)}
                      onClick={() => setAttended(val)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        active
                          ? val === true
                            ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
                            : val === false
                            ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                            : 'bg-slate-100 text-foreground ring-1 ring-border'
                          : 'bg-transparent text-muted-foreground hover:bg-accent ring-1 ring-border'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              ) : (
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">Attendance can only be marked on the day of the appointment.</p>
              );
            })()}
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="Add notes..."
            />
          </div>

          {event.cancellation_reason && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Cancellation Reason</div>
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{event.cancellation_reason}</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
          {showConfirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600 font-medium">Cancel this appointment?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? <span className="flex items-center gap-2"><HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" /><span>Cancelling...</span></span> : 'Yes, Cancel'}
              </button>
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-3 py-1.5 text-xs font-medium bg-accent text-foreground rounded-lg hover:bg-accent/80 transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirmDelete(true)}
              disabled={event.status === 'cancelled'}
              className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel Appointment
            </button>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-foreground bg-accent rounded-lg hover:bg-accent/80 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <span className="flex items-center gap-2"><HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" /><span>Saving...</span></span> : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
