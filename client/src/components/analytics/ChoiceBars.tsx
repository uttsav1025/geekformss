import { plural } from '../../lib/questionOps';
import type { ChoiceStats } from '../../types/api';
import type { Tooltip } from '../../hooks/useTooltip';

/** Horizontal bar per option; the most-picked option's label is emphasised. */
export default function ChoiceBars({ q, tooltip }: { q: ChoiceStats; tooltip: Tooltip }) {
  const max = Math.max(...q.options.map((o) => o.count), 1);
  const top = Math.max(...q.options.map((o) => o.count));
  return (
    <div className="flex flex-col gap-1">
      {q.type === 'multi' && (
        <p className="mb-2 text-[13px] text-muted">Respondents could pick several, so percentages are of people who answered</p>
      )}
      {q.options.map((o) => (
        <div
          key={o.id}
          className="-mx-2 grid h-8 grid-cols-[minmax(80px,34%)_1fr_88px] items-center gap-3 rounded-sm px-2 hover:bg-raised max-sm:h-auto max-sm:grid-cols-[1fr_auto] max-sm:gap-y-1 max-sm:py-1"
          onMouseEnter={(e) =>
            tooltip.show(
              e,
              <>
                <strong>{o.label}</strong>
                <br />
                {o.count} {plural(o.count, 'response')} · {o.percent}%
              </>,
            )
          }
          onMouseLeave={tooltip.hide}
        >
          <span className={`truncate text-sm ${o.count === top && top > 0 ? 'font-medium text-fg' : 'text-fg-2'}`}>
            {o.label}
          </span>
          <div className="h-2 overflow-hidden rounded-[4px] bg-track max-sm:col-span-full max-sm:row-start-2">
            <div className="h-full rounded-r-[4px] bg-series" style={{ width: `${(o.count / max) * 100}%` }} />
          </div>
          <span className="text-right font-mono text-xs tabular-nums">
            {o.count} <span className="text-muted">({o.percent}%)</span>
          </span>
        </div>
      ))}
    </div>
  );
}
