import { ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

interface SlidePanelShellProps {
  title: string;
  slideClass: string;
  onClose: () => void;
  children: ReactNode;
}

export function SlidePanelShell({ title, slideClass, onClose, children }: SlidePanelShellProps) {
  return (
    <div className={`fixed top-0 right-0 h-full w-full lg:w-[480px] bg-white border-l border-slate-200 z-40 flex flex-col transition-transform duration-200 ease-out ${slideClass}`}>
      <div className="flex items-center justify-between px-7 pt-5 pb-2 shrink-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-[0.12em]">{title}</span>
        <button onClick={onClose} data-close-modal className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </button>
      </div>
      {children}
    </div>
  );
}
