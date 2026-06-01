import { HugeiconsIcon } from '@hugeicons/react';
import { Database01Icon } from '@hugeicons/core-free-icons';

interface EmptyStateProps {
  icon?: any;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = Database01Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="size-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <HugeiconsIcon icon={icon} className="size-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
