import InkTick from './InkTick';

import type { SurveyStatus } from '../../types/api';

const LABELS: Record<SurveyStatus, string> = { draft: 'Draft', published: 'Live', closed: 'Closed' };

/** Quiet status text. A live survey carries the ink tick. */
export default function StatusBadge({ status }: { status: SurveyStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13px]/5 font-medium whitespace-nowrap ${status === 'published' ? 'text-fg' : 'text-fg-2'}`}
    >
      {status === 'published' ? (
        <InkTick size={14} strokeWidth={2.6} />
      ) : (
        <span className={`mx-1 size-1.5 rounded-full ${status === 'closed' ? 'bg-danger' : 'bg-muted'}`} aria-hidden="true" />
      )}
      {LABELS[status]}
    </span>
  );
}
