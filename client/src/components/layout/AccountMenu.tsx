import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import type { User } from '../../types/api';

/** Up to two initials from a display name: "Demo Admin" -> "DA". */
export function initials(name = ''): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-grid flex-none place-items-center rounded-full bg-raised leading-none font-semibold tracking-[0.02em] text-fg-2 shadow-[inset_0_0_0_1px_var(--line-strong)] select-none"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/**
 * Account button (avatar + name) that opens a small menu with the signed-in
 * identity and Log out (the theme switch lives in the top bar). Closes on outside click, Escape, or Tab out.
 */
export default function AccountMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const itemRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    itemRef.current?.focus();
    const outside = (e: Event) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', outside);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={`inline-flex h-9 items-center gap-2 rounded-[18px] border-0 pr-2 pl-1 text-sm font-medium text-fg transition-[background-color] duration-150 ease-gf hover:bg-raised ${open ? 'bg-raised' : 'bg-transparent'}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account: ${user.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={user.name} />
        <span className="max-sm:hidden">{user.name}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          className={`text-muted transition-transform duration-180 ease-gf ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="menu-pop top-[calc(100%_+_8px)] right-0 w-64" id={menuId} role="menu" aria-label="Account">
          <div className="mb-1 flex items-center gap-3 border-b border-line p-3" role="none">
            <Avatar name={user.name} size={36} />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="meta truncate">{user.email}</span>
            </div>
          </div>
          <button ref={itemRef} type="button" role="menuitem" className="menu-item" onClick={() => onLogout()}>
            <LogOut size={16} strokeWidth={1.5} aria-hidden="true" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
