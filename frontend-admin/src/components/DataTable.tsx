import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: any;
  emptyAction?: ReactNode;
  onRowClick?: (item: T) => void;
  skeletonRows?: number;
  keyExtractor: (item: T) => string;
  mobileCard?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage,
  emptyIcon,
  emptyAction,
  onRowClick,
  skeletonRows = 5,
  keyExtractor,
  mobileCard = false,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} className="h-10 bg-slate-100 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={emptyMessage || 'No data'} icon={emptyIcon} action={emptyAction} />;
  }

  if (mobileCard) {
    return (
      <div className="space-y-3">
        {data.map(item => (
          <div
            key={keyExtractor(item)}
            onClick={() => onRowClick?.(item)}
            className={cn(
              'bg-card rounded-xl border border-border p-4 space-y-2 transition-all',
              onRowClick && 'cursor-pointer hover:border-border hover:shadow-sm'
            )}
          >
            {columns.filter(c => !c.hideOnMobile).map(col => (
              <div key={col.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider shrink-0">{col.header}</span>
                <span className="text-foreground text-right">{col.render(item)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  'text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-2.5 px-3',
                  col.hideOnMobile && 'hidden lg:table-cell',
                  col.headerClassName
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              className={cn(
                'border-b border-border transition-all',
                onRowClick && 'cursor-pointer hover:bg-muted/80 hover:scale-[1.02] hover:shadow-md transform-gpu'
              )}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={cn(
                    'py-2.5 px-3 text-sm text-foreground',
                    col.hideOnMobile && 'hidden lg:table-cell',
                    col.className
                  )}
                >
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
