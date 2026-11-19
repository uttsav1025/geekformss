import { type ReactNode, useMemo } from 'react';
import { type Answers, type SurveySchema, getVisibleQuestions, isAnswered } from '@survey/shared';
import type { OnAnswer } from '../../types/ui';

interface SurveyFormProps {
  title: string;
  description?: string;
  schema: SurveySchema;
  answers: Answers;
  onAnswer: OnAnswer;
  errors?: Record<string, string>;
  onSubmit?: () => void;
  submitting?: boolean;
  footer?: ReactNode;
  preview?: boolean;
  honeypot?: string;
  onHoneypot?: (value: string) => void;
}
import QuestionField from './QuestionField';

/**
 * Renders a survey schema as a form. Visibility is recomputed from answers on
 * every change, so conditional questions appear/disappear live.
 */
export default function SurveyForm({
  title,
  description,
  schema,
  answers,
  onAnswer,
  errors = {},
  onSubmit,
  submitting,
  footer,
  preview = false,
  honeypot,
  onHoneypot,
}: SurveyFormProps) {
  const visible = useMemo(() => getVisibleQuestions(schema, answers), [schema, answers]);
  const answeredCount = visible.filter((q) => isAnswered(answers[q.id])).length;
  const progress = visible.length ? (answeredCount / visible.length) * 100 : 0;

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <header className="px-1 pb-3">
        <h1 className="mb-3 text-[32px]/[1.12] tracking-[-0.015em] max-sm:text-[28px]">{title || 'Untitled survey'}</h1>
        {description && (
          <p className="m-0 max-w-xl text-[17px]/[26px] whitespace-pre-wrap text-fg-2 max-sm:text-[15px]/[22px]">{description}</p>
        )}
      </header>

      {/* Progress tally: sticky on the live form, static inside the builder preview. */}
      <div
        className={`${preview ? 'static' : 'sticky'} top-0 z-5 mb-1 flex items-center gap-3 bg-bg px-1 py-3 font-mono text-xs text-muted`}
        aria-live="polite"
      >
        <div className="h-0.5 flex-1 overflow-hidden rounded-[1px] bg-line-strong" aria-hidden="true">
          <div
            className="h-full origin-left bg-accent transition-transform duration-300 ease-gf"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
        <span className="text-fg-2">
          {answeredCount} of {visible.length} answered
        </span>
        <span>
          <span className="text-danger">*</span> required
        </span>
      </div>

      {visible.length === 0 && <div className="card p-6 text-center text-fg-2">This survey has no questions yet</div>}

      {visible.map((q, i) => (
        <div
          key={q.id}
          className={`card animate-fade-in p-6 max-sm:px-4 max-sm:py-5 ${errors[q.id] ? 'border-[color-mix(in_srgb,var(--danger)_40%,transparent)]' : ''}`}
        >
          <QuestionField
            question={q}
            number={i + 1}
            value={answers[q.id]}
            onChange={(v) => onAnswer(q.id, v)}
            error={errors[q.id]}
          />
        </div>
      ))}

      {/* Honeypot: invisible to humans, tempting to bots. */}
      {onHoneypot && (
        <div className="absolute -left-[10000px] size-px overflow-hidden" aria-hidden="true">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={honeypot ?? ''} onChange={(e) => onHoneypot(e.target.value)} />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 pt-3">
        <button className="btn btn-primary btn-lg" disabled={submitting || preview || visible.length === 0}>
          {submitting ? 'Sending…' : preview ? 'Submit is off in preview' : 'Submit answers'}
        </button>
        {footer}
      </div>
    </form>
  );
}
