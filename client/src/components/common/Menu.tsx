import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';

export type MenuItem =
  | { separator: true }
  | { render: () => ReactNode }
  | { label: string; icon?: ReactNode; onSelect: () => void; disabled?: boolean; danger?: boolean };

interface MenuProps {
  label: string;
  trigger: ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  className?: string;
  triggerClassName?: string;
}

const isAction = (it: MenuItem): it is Extract<MenuItem, { label: string }> => 'label' in it;

/**
 * Small action menu (WAI-ARIA menu button). `items` are
 * { label, icon?, onSelect, disabled?, danger? } or { separator: true }.
 * Arrow keys / Home / End move, Enter or Space runs, Esc or Tab closes,
 * focus returns to the trigger.
 */
export default function Menu({
  label,
  trigger,
  items,
  align = 'right',
  className = '',
  triggerClassName = 'icon-btn',
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const actionable = items.map((it, i) => (isAction(it) && !it.disabled ? i : -1)).filter((i) => i >= 0);

  const focusItem = (i: number | undefined) => {
    if (i !== undefined) itemRefs.current[i]?.focus();
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    focusItem(actionable[0]);
    const outside = (e: Event) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('focusin', outside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = actionable.indexOf(itemRefs.current.indexOf(document.activeElement as HTMLButtonElement));
    const go = (n: number) => {
      e.preventDefault();
      focusItem(actionable[(n + actionable.length) % actionable.length]);
    };
    if (e.key === 'ArrowDown') go(cur + 1);
    else if (e.key === 'ArrowUp') go(cur - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(actionable.length - 1);
    else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') close(false);
  };

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={`${triggerClassName} ${open ? 'bg-raised text-fg' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`menu-pop top-[calc(100%_+_4px)] ${align === 'left' ? 'left-0' : 'right-0'}`}
          role="menu"
          id={id}
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onMenuKey}
        >
          {items.map((it, i) =>
            'separator' in it ? (
              <div key={`sep-${i}`} className="mx-2 my-1 h-px bg-line" role="separator" />
            ) : 'render' in it ? (
              <div key={`r-${i}`} className="px-2 py-1">
                {it.render()}
              </div>
            ) : (
              <button
                key={it.label}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={it.disabled}
                className={`menu-item ${it.danger ? 'text-danger' : ''}`}
                onClick={() => {
                  close();
                  it.onSelect();
                }}
              >
                {it.icon}
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
