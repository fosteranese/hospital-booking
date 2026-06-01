import { HugeiconsIcon } from '@hugeicons/react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: any;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, icon, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="size-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={icon} className="size-5 text-emerald-600" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
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
