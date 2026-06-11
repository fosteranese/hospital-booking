import { cn } from '@/lib/utils';

interface RefreshButtonProps {
  onClick: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function RefreshButton({ onClick, size = 'md', className }: RefreshButtonProps) {
  const sizeClass = size === 'sm' ? 'w-9 h-9' : 'w-12 h-12';
  const iconClass = size === 'sm' ? 'size-4' : 'size-5';

  return (
    <button
      onClick={onClick}
      className={cn(
        sizeClass,
        'flex items-center justify-center rounded-lg border border-border bg-card shadow-sm hover:bg-muted transition-all shrink-0',
        className
      )}
      title="Refresh data"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={cn('text-muted-foreground', iconClass)}>
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M3 22v-6h6" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      </svg>
    </button>
  );
}
