import { useRefresh } from '@/contexts/refresh-context';
import { cn } from '@/lib/utils';

export function RefreshIndicator() {
  const { isRefreshing } = useRefresh();

  return (
    <div className={cn(
      'h-0.5 w-full overflow-hidden bg-emerald-100/50 transition-opacity duration-300',
      isRefreshing ? 'opacity-100' : 'opacity-0'
    )}>
      <div className={cn(
        'h-full w-1/3 rounded-full bg-emerald-500',
        isRefreshing && 'animate-[refresh-slide_1.2s_ease-in-out_infinite]'
      )} />
    </div>
  );
}
