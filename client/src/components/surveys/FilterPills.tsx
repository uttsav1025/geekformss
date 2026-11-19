import { Check } from 'lucide-react';
import { type Filters, RESPONSE_OPTIONS, STATUS_OPTIONS, toggleStatus } from '../../lib/filters';
import type { SurveyFacets } from '../../types/api';

interface PillProps {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  count: number;
}

function Pill({ on, disabled = false, onClick, label, count }: PillProps) {
  return (
    <button
      type="button"
      className={`inline-flex h-8 flex-none items-center gap-1.5 rounded-2xl border px-3 text-[13px] font-medium whitespace-nowrap transition-[background-color,border-color,color] duration-150 ease-gf disabled:cursor-not-allowed disabled:opacity-45 ${
        on
          ? 'border-accent-line bg-accent-soft text-accent'
          : 'border-line-strong bg-surface text-fg-2 enabled:hover:bg-raised enabled:hover:text-fg'
      }`}
      aria-pressed={on}
      disabled={disabled && !on}
      onClick={onClick}
    >
      {on && <Check size={14} strokeWidth={2} aria-hidden="true" />}
      {label}
      <span className={`font-mono text-xs font-normal tabular-nums ${on ? 'text-accent' : 'text-muted'}`}>{count}</span>
    </button>
  );
}

/**
 * The filters as a horizontal strip of pills, one group per facet. Same state
 * and contextual counts as the Filter menu: a pill that would leave nothing is
 * disabled unless it is already on.
 */
interface FilterPillsProps {
  /** Server-computed counts for the current search and filters. */
  counts: SurveyFacets;
  value: Filters;
  onChange: (next: Filters) => void;
  hideStatus?: boolean;
}

export default function FilterPills({ counts: c, value, onChange, hideStatus = false }: FilterPillsProps) {
  return (
    <div
      className="thin-scroll flex items-center gap-3 overflow-x-auto px-6 py-3 max-sm:px-4"
      role="toolbar"
      aria-label="Filters"
    >
      {!hideStatus && (
        <>
          <div className="flex flex-none gap-2" role="group" aria-label="Status">
            <Pill
              on={!value.status.length}
              onClick={() => onChange({ ...value, status: [] })}
              label="All statuses"
              count={c.statusAll}
            />
            {STATUS_OPTIONS.map((o) => (
              <Pill
                key={o.value}
                on={value.status.includes(o.value)}
                disabled={!c.status[o.value]}
                onClick={() => onChange(toggleStatus(value, o.value))}
                label={o.label}
                count={c.status[o.value]}
              />
            ))}
          </div>
          <span className="h-5 w-px flex-none bg-line-strong" aria-hidden="true" />
        </>
      )}
      <div className="flex flex-none gap-2" role="group" aria-label="Responses">
        {RESPONSE_OPTIONS.map((o) => (
          <Pill
            key={o.value}
            on={value.responses === o.value}
            disabled={!c.responses[o.value]}
            onClick={() => onChange({ ...value, responses: o.value })}
            label={o.value === 'any' ? 'Any responses' : o.label}
            count={c.responses[o.value]}
          />
        ))}
      </div>
      {(c.anyUnpublished || value.unpublished) && (
        <>
          <span className="h-5 w-px flex-none bg-line-strong" aria-hidden="true" />
          <div className="flex flex-none gap-2" role="group" aria-label="Changes">
            <Pill
              on={value.unpublished}
              disabled={!c.unpublished}
              onClick={() => onChange({ ...value, unpublished: !value.unpublished })}
              label="Unpublished edits"
              count={c.unpublished}
            />
          </div>
        </>
      )}
    </div>
  );
}
