import { HugeiconsIcon } from '@hugeicons/react';
import { Loading02Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: any;
  iconRight?: any;
}

const variants = {
  primary:
    'bg-emerald-600 text-white shadow-[0_1px_3px_rgba(5,150,105,0.2)] hover:bg-emerald-500 active:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:active:bg-emerald-600',
  secondary:
    'bg-card text-foreground border border-border shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-muted hover:border-border active:bg-muted dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]',
  ghost:
    'text-muted-foreground hover:bg-muted active:bg-muted',
  danger:
    'bg-red-600 text-white shadow-[0_1px_3px_rgba(220,38,38,0.2)] hover:bg-red-500 active:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400 dark:active:bg-red-600',
};

const sizes = {
  sm: 'h-8 px-4 text-xs gap-1.5 rounded-full',
  md: 'h-9 px-5 text-sm gap-2 rounded-full',
  lg: 'h-10 px-6 text-sm gap-2 rounded-full',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        'disabled:opacity-50 disabled:pointer-events-none',
        'active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:focus-visible:ring-emerald-400/40 focus-visible:ring-offset-1',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" />
      ) : Icon ? (
        <HugeiconsIcon icon={Icon} className="size-4" />
      ) : null}
      {children}
      {IconRight && !loading && <HugeiconsIcon icon={IconRight} className="size-4" />}
    </button>
  );
}
