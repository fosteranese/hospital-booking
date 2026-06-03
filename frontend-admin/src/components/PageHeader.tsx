import { HugeiconsIcon } from '@hugeicons/react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: any;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <div className="size-9 rounded-lg flex items-center justify-center shrink-0 text-emerald-600">
            <HugeiconsIcon icon={icon} className="size-5" />
          </div>
        )}
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
