/**
 * One horizontal block of key numbers, items split by hairlines (Home and
 * Results share it). items: [{ label, value, note?, lead? }]; `lead` makes that
 * figure the largest on the strip.
 *
 * Dividers: each item draws a hairline on its left and top via box-shadow, and
 * the strip's overflow clips the outer edges, so rows that wrap on phones get
 * dividers in both directions.
 */
import type { ReactNode } from 'react';

export interface Stat {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  lead?: boolean;
}

export default function StatStrip({ items }: { items: Stat[] }) {
  return (
    <dl className="card m-0 grid grid-cols-[repeat(auto-fit,minmax(136px,1fr))] overflow-hidden max-sm:grid-cols-2">
      {items.map((s) => (
        <div
          key={s.label}
          className="px-6 py-4 shadow-[-1px_0_0_var(--line),0_-1px_0_var(--line)] max-sm:px-4 max-sm:py-3 max-sm:last:odd:col-span-full"
        >
          <dt className="text-[13px]/5 text-fg-2">{s.label}</dt>
          <dd className={`m-0 mt-1 font-medium tabular-nums ${s.lead ? 'text-[32px]/9' : 'text-2xl/7 max-sm:text-xl/6'}`}>
            {s.value}
          </dd>
          {s.note && <dd className="m-0 mt-1 text-[13px]/5 text-muted">{s.note}</dd>}
        </div>
      ))}
    </dl>
  );
}
