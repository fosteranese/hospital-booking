import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

interface ErrorAlertProps {
  message: string;
  variant?: 'default' | 'compact';
  className?: string;
}

export function ErrorAlert({ message, variant = 'default', className }: ErrorAlertProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 bg-red-50 dark:bg-red-950/40 rounded-lg',
        variant === 'compact'
          ? 'text-xs text-red-700 dark:text-red-400 px-3.5 py-2.5'
          : 'text-sm text-red-700 dark:text-red-400 px-4 py-3 ring-1 ring-red-200/50 dark:ring-red-900/50',
        className
      )}
    >
      <HugeiconsIcon icon={AlertCircleIcon} className={cn('shrink-0', variant === 'compact' ? 'size-3.5' : 'size-4')} />
      {message}
    </div>
  );
}
