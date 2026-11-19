import StatStrip from '../common/StatStrip';
import { fmtDate, fmtRelative } from '../../lib/format';

import type { Analytics } from '../../types/api';

const nf = new Intl.NumberFormat();

/** Responses, completion, in progress and recency, in the shared stat strip. */
export default function SummaryStats({ totals }: { totals: Analytics['totals'] }) {
  return (
    <StatStrip
      items={[
        {
          label: 'Responses',
          value: nf.format(totals.responses),
          note: `of ${nf.format(totals.responses + totals.partial)} started`,
          lead: true,
        },
        {
          label: 'Completion rate',
          value: totals.completionRate == null ? '—' : `${totals.completionRate}%`,
          note: 'Submitted of started',
        },
        { label: 'In progress', value: nf.format(totals.partial), note: 'Started in the last 30 days' },
        {
          label: 'Last response',
          value: fmtRelative(totals.lastResponseAt),
          note: totals.lastResponseAt ? fmtDate(totals.lastResponseAt) : 'None yet',
        },
      ]}
    />
  );
}
