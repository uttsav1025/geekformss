import { type KeyboardEvent, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Custom select (WAI-ARIA "select-only combobox" pattern) replacing native
 * <select>, so menus match the rest of the UI in every theme.
 *
 * options: [{ value, label, hint?, disabled? }]
 * Keyboard: Enter/Space/ArrowDown open; arrows/Home/End move; Enter/Space
 * choose; Esc closes; Tab chooses-and-leaves; typing letters jumps to a match.
 * Values are compared as strings so numeric values work too.
 */
export interface SelectOption<V extends string | number> {
  value: V;
  label: string;
  hint?: string;
  disabled?: boolean;
}

interface SelectProps<V extends string | number> {
  value: V | undefined;
  onChange: (value: V) => void;
  options: SelectOption<V>[];
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export default function Select<V extends string | number>({
  value,
  onChange,
  options,
  id,
  className = '',
  placeholder = 'Choose…',
  disabled = false,
  compact = false,
  ...aria
}: SelectProps<V>) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const listId = `${baseId}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [placeUp, setPlaceUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeRef = useRef({ text: '', t: 0 });

  const selectedIndex = options.findIndex((o) => String(o.value) === String(value));
  const selected = options[selectedIndex];
  const enabledIdx = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  const openList = useCallback(
    (at?: number) => {
      if (disabled) return;
      setActive(at ?? (selectedIndex >= 0 ? selectedIndex : (enabledIdx[0] ?? -1)));
      setOpen(true);
    },
    [disabled, selectedIndex, enabledIdx],
  );
  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) btnRef.current?.focus();
  };
  const choose = (i: number, focusButton = true) => {
    const o = options[i];
    if (!o || o.disabled) return;
    if (String(o.value) !== String(value)) onChange(o.value);
    close(focusButton);
  };

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Flip upward when there is no room below; keep the active option in view.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    setPlaceUp(below < 240 && r.top > below);
  }, [open]);
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const move = (dir: number) => {
    if (!enabledIdx.length) return;
    const pos = enabledIdx.indexOf(active);
    const next = pos < 0 ? enabledIdx[0] : enabledIdx[Math.min(Math.max(pos + dir, 0), enabledIdx.length - 1)];
    if (next !== undefined) setActive(next);
  };

  const typeahead = (ch: string) => {
    const now = Date.now();
    const t = typeRef.current;
    t.text = now - t.t > 600 ? ch : t.text + ch;
    t.t = now;
    const from = Math.max(active, 0);
    const order = [...options.keys()].map((k) => (k + from + (t.text.length === 1 ? 1 : 0)) % options.length);
    const hit = order.find((i) => {
      const o = options[i];
      return o && !o.disabled && o.label.toLowerCase().startsWith(t.text.toLowerCase());
    });
    const o = hit === undefined ? undefined : options[hit];
    if (hit !== undefined && o) {
      if (open) setActive(hit);
      else if (String(o.value) !== String(value)) onChange(o.value);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const k = e.key;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(k)) {
        e.preventDefault();
        openList();
      } else if (k.length === 1 && /\S/.test(k)) typeahead(k);
      return;
    }
    if (k === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (k === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (k === 'Home') {
      e.preventDefault();
      setActive(enabledIdx[0] ?? -1);
    } else if (k === 'End') {
      e.preventDefault();
      setActive(enabledIdx[enabledIdx.length - 1] ?? -1);
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      choose(active);
    } else if (k === 'Escape') {
      e.preventDefault();
      close();
    } else if (k === 'Tab') {
      choose(active, false);
    } else if (k.length === 1 && /\S/.test(k)) typeahead(k);
  };

  return (
    <div className={`relative min-w-0 ${className}`} ref={wrapRef}>
      <button
        ref={btnRef}
        id={baseId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${baseId}-opt-${active}` : undefined}
        disabled={disabled}
        className={`flex w-full items-center justify-between gap-2 rounded-md border text-left transition-[border-color,box-shadow,background-color] duration-150 ease-gf focus-visible:border-accent focus-visible:bg-surface focus-visible:ring-3 focus-visible:ring-accent-soft focus-visible:outline-none enabled:hover:border-[color-mix(in_srgb,var(--text)_28%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 ${
          compact ? 'min-h-9 px-3 py-1.5 text-sm' : 'min-h-10 px-3 py-2 text-[15px]'
        } ${open ? 'border-accent bg-surface ring-3 ring-accent-soft' : 'border-line-strong bg-field'}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        {...aria}
      >
        <span className={`min-w-0 truncate ${selected ? '' : 'text-muted'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          className={`flex-none text-muted transition-transform duration-180 ease-gf ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className={`absolute left-0 z-40 m-0 max-h-70 w-max max-w-[min(420px,90vw)] min-w-full animate-menu-in list-none overflow-y-auto rounded-lg border border-line-strong bg-surface p-1 shadow-float ${
            placeUp ? 'bottom-[calc(100%_+_4px)]' : 'top-[calc(100%_+_4px)]'
          }`}
          tabIndex={-1}
          aria-labelledby={aria['aria-labelledby']}
        >
          {options.map((o, i) => {
            const isSel = i === selectedIndex;
            return (
              // Keyboard selection lives on the trigger (aria-activedescendant); options take pointer input.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <li
                key={`${o.value}`}
                id={`${baseId}-opt-${i}`}
                data-i={i}
                role="option"
                aria-selected={isSel}
                aria-disabled={o.disabled || undefined}
                className={`flex min-h-9 items-center justify-between gap-3 rounded-sm py-1.5 pr-2 pl-3 text-sm ${i === active ? 'bg-raised' : ''} ${isSel ? 'font-medium' : ''} ${
                  o.disabled ? 'cursor-not-allowed text-muted' : 'cursor-pointer text-fg'
                }`}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
              >
                <span className="flex min-w-0 flex-col">
                  {o.label}
                  {o.hint && <span className="font-mono text-xs font-normal text-muted">{o.hint}</span>}
                </span>
                {isSel && <Check size={16} strokeWidth={1.5} aria-hidden="true" className="flex-none text-accent" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
