import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUp01Icon, ArrowDown01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: any;
  color: 'emerald' | 'blue' | 'red' | 'purple' | 'amber' | 'slate';
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  comparisonText?: string;
  className?: string;
}

const colorMap = {
  emerald: {
    border: 'border-l-emerald-500',
    icon: 'bg-emerald-100 text-emerald-600',
    pill: 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200/50',
  },
  blue: {
    border: 'border-l-blue-500',
    icon: 'bg-blue-100 text-blue-600',
    pill: 'text-blue-700 bg-blue-50 ring-1 ring-blue-200/50',
  },
  red: {
    border: 'border-l-red-500',
    icon: 'bg-red-100 text-red-600',
    pill: 'text-red-700 bg-red-50 ring-1 ring-red-200/50',
  },
  purple: {
    border: 'border-l-purple-500',
    icon: 'bg-purple-100 text-purple-600',
    pill: 'text-purple-700 bg-purple-50 ring-1 ring-purple-200/50',
  },
  amber: {
    border: 'border-l-amber-500',
    icon: 'bg-amber-100 text-amber-600',
    pill: 'text-amber-700 bg-amber-50 ring-1 ring-amber-200/50',
  },
  slate: {
    border: 'border-l-slate-500',
    icon: 'bg-slate-100 text-slate-600',
    pill: 'text-slate-700 bg-slate-50 ring-1 ring-slate-200/50',
  },
};

const trendIconMap = {
  up: ArrowUp01Icon,
  down: ArrowDown01Icon,
  flat: ArrowRight01Icon,
};

const trendColorMap = {
  up: 'text-emerald-600',
  down: 'text-red-500',
  flat: 'text-slate-400',
};

export function KpiCard({ label, value, icon, color, trend, trendLabel, comparisonText, className }: KpiCardProps) {
  const styles = colorMap[color];
  const TrendIcon = trend ? trendIconMap[trend] : null;

  return (
    <div className={cn(
      'bg-card rounded-lg shadow-[0_1px_3px_0_rgb(0,0,0,0.06),0_1px_2px_-1px_rgb(0,0,0,0.04)]',
      'border-l-4',
      styles.border,
      'p-5',
      className
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn('size-9 rounded-lg flex items-center justify-center shrink-0', styles.icon)}>
            <HugeiconsIcon icon={icon} className="size-[18px]" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        {trend && TrendIcon && trendLabel && (
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
            styles.pill
          )}>
            <HugeiconsIcon icon={TrendIcon} className="size-3" />
            {trendLabel}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-foreground tracking-tight mb-2">
        {value}
      </div>
      {comparisonText && (
        <div className={cn(
          'flex items-center gap-1 text-[11px] font-medium',
          trend ? trendColorMap[trend] : 'text-muted-foreground'
        )}>
          {TrendIcon && <HugeiconsIcon icon={TrendIcon} className="size-3" />}
          {comparisonText}
        </div>
      )}
    </div>
  );
}
