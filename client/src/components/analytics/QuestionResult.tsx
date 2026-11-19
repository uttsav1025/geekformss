import { QUESTION_TYPE_LABELS } from '@survey/shared';
import ChoiceBars from './ChoiceBars';
import RatingResult from './RatingResult';
import TextResult from './TextResult';
import type { QuestionStats } from '../../types/api';
import type { Tooltip } from '../../hooks/useTooltip';

interface QuestionResultProps {
  q: QuestionStats;
  surveyId: string;
  version: string;
  tooltip: Tooltip;
}

/** One question's card on the results page; the body depends on the question type. */
export default function QuestionResult({ q, surveyId, version, tooltip }: QuestionResultProps) {
  return (
    <section className="card overflow-hidden p-0">
      {/* Accent band + hairline divider: the question reads first, its results below. */}
      <header className="flex items-start gap-3 border-b border-accent-line bg-accent-soft px-6 py-4 max-sm:px-5">
        <span className="mt-px flex-none rounded-sm bg-accent px-1.5 font-mono text-xs/5 font-medium text-accent-ink tabular-nums">
          Q{q.index}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-fg">{q.label}</h3>
          <p className="m-0 mt-1 text-[13px]/5 text-fg-2">
            {QUESTION_TYPE_LABELS[q.type]} · {q.answeredCount} answered
            {q.skippedCount > 0 && ` · ${q.skippedCount} ${q.conditional ? 'skipped or not shown' : 'skipped'}`}
            {q.conditional && <span className="chip chip-logic ml-2">Conditional</span>}
          </p>
        </div>
      </header>
      <div className="p-6 in-[.fill]:flex in-[.fill]:min-h-0 in-[.fill]:flex-1 in-[.fill]:flex-col max-sm:p-5">
        {(q.type === 'single' || q.type === 'multi') && <ChoiceBars q={q} tooltip={tooltip} />}
        {q.type === 'rating' && <RatingResult q={q} tooltip={tooltip} />}
        {q.type === 'text' && <TextResult q={q} surveyId={surveyId} version={version} />}
      </div>
    </section>
  );
}
