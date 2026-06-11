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
    <div className={`fixed top-0 right-0 h-full w-full lg:w-[480px] bg-card border-l border-border z-40 flex flex-col transition-transform duration-200 ease-out ${slideClass}`}>
      <div className="flex items-center justify-between px-7 pt-5 pb-2 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em]">{title}</span>
        <button onClick={onClose} data-close-modal aria-label="Close panel" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </button>
      </div>
      {children}
    </div>
  );
}
