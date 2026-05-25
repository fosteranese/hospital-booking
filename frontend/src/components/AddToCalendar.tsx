import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { GoogleIcon, AppleIcon, CalendarAdd01Icon } from '@hugeicons/core-free-icons';
import { downloadIcs, getGoogleCalendarUrl, getOutlookUrl } from '@/lib/calendar';

interface AddToCalendarProps {
  title: string;
  description: string;
  location: string;
  startDate: string;
  startTime: string;
  endTime: string;
}

export function AddToCalendar({ title, description, location, startDate, startTime, endTime }: AddToCalendarProps) {
  const event = { title, description, location, startDate, startTime, endTime };

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest text-center">
        Add to calendar
      </p>
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 bg-white/80 hover:bg-white px-3"
          onClick={() => window.open(getGoogleCalendarUrl(event), '_blank', 'noopener')}
        >
          <HugeiconsIcon icon={GoogleIcon} strokeWidth={2} className="size-3.5" />
          <span className="text-xs">Google</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 bg-white/80 hover:bg-white px-3"
          onClick={() => downloadIcs(event)}
        >
          <HugeiconsIcon icon={AppleIcon} strokeWidth={2} className="size-3.5" />
          <span className="text-xs">Apple</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 bg-white/80 hover:bg-white px-3"
          onClick={() => window.open(getOutlookUrl(event), '_blank', 'noopener')}
        >
          <HugeiconsIcon icon={CalendarAdd01Icon} strokeWidth={2} className="size-3.5" />
          <span className="text-xs">Outlook</span>
        </Button>
      </div>
    </div>
  );
}
