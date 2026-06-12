import { useState, useRef, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, Cancel01Icon, ChevronDownIcon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

interface FilterOption {
  value: string;
  label: string;
}

interface SearchFilterBarProps {
  value: string;
  onChange: (value: string) => void;
  filterValue: string;
  onFilterChange: (value: string) => void;
  placeholderMap: Record<string, string>;
  filterOptions: FilterOption[];
}

export function SearchFilterBar({
  value,
  onChange,
  filterValue,
  onFilterChange,
  placeholderMap,
  filterOptions,
}: SearchFilterBarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentFilter = filterOptions.find(o => o.value === filterValue);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center h-12 w-full max-w-full sm:max-w-[340px] rounded-lg border border-border bg-card focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all shadow-sm">
      <div className="shrink-0 text-muted-foreground ml-3">
        <HugeiconsIcon icon={Search01Icon} className="size-4" />
      </div>
      <input
        type="text"
        placeholder={placeholderMap[filterValue]}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 h-full pl-3 pr-3 text-sm bg-transparent focus:outline-none min-w-0 placeholder:text-muted-foreground"
      />
      {value && (
        <button onClick={() => onChange('')} className="shrink-0 mr-1.5 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </button>
      )}
      <div className="relative p-1.5" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 h-full rounded-md py-1.5 px-2.5 text-xs font-medium text-muted-foreground bg-muted hover:bg-slate-300 active:bg-muted transition-all whitespace-nowrap"
        >
          {currentFilter?.label}
          <HugeiconsIcon icon={ChevronDownIcon} className={cn('size-3 transition-transform duration-150', open && 'rotate-180')} strokeWidth={2} />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1.5 min-w-[8rem] bg-card border border-border rounded-xl shadow-xl z-20 py-1.5 overflow-hidden">
            {filterOptions.map(opt => (
              <button
                key={opt.value}
                onMouseDown={e => { e.preventDefault(); onFilterChange(opt.value); setOpen(false); }}
                className={cn(
                  'w-full text-left px-4 py-2 text-xs transition-colors',
                  opt.value === filterValue
                    ? 'bg-emerald-50 text-emerald-600 font-semibold'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
