import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

const variants = {
  default: 'bg-slate-100 text-foreground',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/50',
  danger: 'bg-red-50 text-red-700 ring-1 ring-red-200/50',
  info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/50',
  neutral: 'bg-slate-50 text-muted-foreground ring-1 ring-border/50',
};

const sizes = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-full',
      variants[variant],
      sizes[size],
      className
    )}>
      {children}
    </span>
  );
}
