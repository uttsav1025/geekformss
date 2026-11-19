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
    <section className="card p-6 max-sm:p-5">
      <header className="mb-4 flex items-start gap-3">
        <span className="w-6 flex-none font-mono text-xs/[22px] text-muted">Q{q.index}</span>
        <div className="min-w-0 flex-1">
          <h3>{q.label}</h3>
          <p className="m-0 mt-1 text-[13px]/5 text-muted">
            {QUESTION_TYPE_LABELS[q.type]} · {q.answeredCount} answered
            {q.skippedCount > 0 && ` · ${q.skippedCount} ${q.conditional ? 'skipped or not shown' : 'skipped'}`}
            {q.conditional && <span className="chip chip-logic ml-2">Conditional</span>}
          </p>
        </div>
      </header>
      {(q.type === 'single' || q.type === 'multi') && <ChoiceBars q={q} tooltip={tooltip} />}
      {q.type === 'rating' && <RatingResult q={q} tooltip={tooltip} />}
      {q.type === 'text' && <TextResult q={q} surveyId={surveyId} version={version} />}
    </section>
  );
}
