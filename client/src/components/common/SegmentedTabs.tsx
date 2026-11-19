/**
 * Segmented tab control (Build / Preview). options: [{ value, label }].
 * Arrow keys move between tabs.
 */
import type { KeyboardEvent } from 'react';

interface SegmentedTabsProps<V extends string> {
  value: V;
  onChange: (value: V) => void;
  options: { value: V; label: string }[];
  label: string;
}

export default function SegmentedTabs<V extends string>({ value, onChange, options, label }: SegmentedTabsProps<V>) {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    const next = options[j];
    if (!next) return;
    onChange(next.value);
    (e.currentTarget.parentElement?.children[j] as HTMLElement | undefined)?.focus(); // roving focus follows selection
  };
  return (
    <div className="inline-flex rounded-md bg-raised p-1" role="tablist" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={`h-7 rounded-[4px] border-0 px-4 text-sm font-medium transition-[background-color,color] duration-150 ease-gf ${
              on ? 'bg-surface text-fg shadow-soft' : 'bg-transparent text-fg-2 hover:text-fg'
            }`}
            onClick={() => onChange(o.value)}
            onKeyDown={onKeyDown}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
