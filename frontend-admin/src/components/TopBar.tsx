import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Logout01Icon,
  UserIcon,
  UserSettingsIcon,
} from '@hugeicons/core-free-icons';
import { useAuth } from '@/contexts/auth-context';

export function TopBar() {
  const { clearAuth, otpIdentifier, userRole } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escapeHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escapeHandler);
    };
  }, []);

  const handleSignOut = () => {
    clearAuth();
    navigate('/');
  };

  const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : '';
  const userInitial = otpIdentifier.charAt(0).toUpperCase();

  return (
    <header className="h-14 shrink-0 bg-white border-b border-slate-200/60 flex items-center justify-end px-6">
      <div className="relative" ref={ref}>
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="flex items-center gap-2 h-8 pl-1.5 pr-3 rounded-full hover:bg-slate-100 transition-colors"
          aria-label="User menu"
        >
          <div className="size-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-[10px] shadow-sm">
            {userInitial}
          </div>
          <span className="text-sm font-medium text-slate-700 hidden sm:block">{otpIdentifier}</span>
        </button>

        {profileOpen && (
          <div className="absolute top-full right-0 mt-1.5 w-56 bg-white rounded-xl shadow-lg shadow-slate-200/60 border border-slate-200/60 overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900 truncate">{otpIdentifier}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{roleLabel}</p>
            </div>
            <div className="p-1.5">
              <button
                onClick={() => { setProfileOpen(false); navigate('/dashboard/settings'); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <HugeiconsIcon icon={UserSettingsIcon} className="size-4 text-slate-400" />
                Account Settings
              </button>
              <div className="my-1 mx-2 h-px bg-slate-100" />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <HugeiconsIcon icon={Logout01Icon} className="size-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
