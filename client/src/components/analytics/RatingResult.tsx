import { plural } from '../../lib/questionOps';
import type { RatingStats } from '../../types/api';
import type { Tooltip } from '../../hooks/useTooltip';

// Ordinal ramp for ratings 1..5 (light → dark ink).
const RAMP: Record<number, string> = { 1: 'bg-ramp-1', 2: 'bg-ramp-2', 3: 'bg-ramp-3', 4: 'bg-ramp-4', 5: 'bg-ramp-5' };

/** Average as a hero number next to the 1–5 distribution. */
export default function RatingResult({ q, tooltip }: { q: RatingStats; tooltip: Tooltip }) {
  const total = q.distribution.reduce((s, d) => s + d.count, 0);
  const max = Math.max(...q.distribution.map((d) => d.count), 1);
  return (
    <div className="flex flex-wrap items-end gap-8 in-[.fill]:my-auto">
      <div className="flex flex-col gap-1">
        <span className="mb-1 text-5xl/none font-medium tracking-[-0.02em] tabular-nums">
          {q.average == null ? '—' : q.average.toFixed(2)}
        </span>
        <span className="text-[13px]/5 text-muted">average out of 5</span>
        <span className="text-[13px]/5 text-muted">
          {total} {plural(total, 'rating')}
        </span>
      </div>
      <div className="flex min-w-55 flex-1 items-end gap-3">
        {q.distribution.map((d) => (
          <div
            key={d.value}
            className="flex flex-1 cursor-default flex-col items-center gap-1 [&:hover_.bar]:brightness-110"
            onMouseEnter={(e) =>
              tooltip.show(
                e,
                <>
                  <strong>Rated {d.value}</strong>
                  <br />
                  {d.count} · {total ? Math.round((d.count / total) * 100) : 0}%
                </>,
              )
            }
            onMouseLeave={tooltip.hide}
          >
            <div className="flex h-29 w-full max-w-11 items-end pt-5 in-[.fill]:h-70">
              <div
                className={`bar relative min-h-0.5 w-full rounded-t-[4px] ${RAMP[d.value]}`}
                style={{ height: `${(d.count / max) * 100}%` }}
              >
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 pb-1 font-mono text-xs text-muted tabular-nums">
                  {d.count}
                </span>
              </div>
            </div>
            <span className="font-mono text-xs text-fg-2 tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
