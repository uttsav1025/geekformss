import { LIMITS, type Question } from '@survey/shared';
import type { ChangeEvent } from 'react';
import type { AnswerValue } from '../../types/ui';
import InkTick from '../common/InkTick';

const RATING_HINTS: Record<number, string> = { 1: 'Very poor', 2: 'Poor', 3: 'Okay', 4: 'Good', 5: 'Excellent' };

// Answer controls sit under the question text (indented past the number) on wide screens.
const INDENT = 'ml-7 max-sm:ml-0';

/**
 * One choice row. The native input stays (keyboard, screen readers, forms);
 * the visible box is drawn on top and gets an ink tick when chosen.
 */
interface ChoiceProps {
  type: 'radio' | 'checkbox';
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}

function Choice({ type, name, checked, onChange, label }: ChoiceProps) {
  return (
    <label
      className={`relative flex min-h-11 cursor-pointer items-center gap-3 rounded-md border py-2.5 pr-4 pl-3 text-[15px] transition-[background-color,border-color] duration-150 ease-gf ${
        checked ? 'border-accent-line bg-accent-soft' : 'border-line-strong hover:bg-raised'
      }`}
    >
      <input type={type} name={name} checked={checked} onChange={onChange} className="peer absolute size-px opacity-0" />
      <span
        className={`grid size-5 flex-none place-items-center border-[1.5px] bg-surface transition-[border-color] duration-150 ease-gf peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
          type === 'radio' ? 'rounded-full' : 'rounded-[4px]'
        } ${checked ? 'border-accent' : 'border-line-strong'}`}
        aria-hidden="true"
      >
        {checked && <InkTick size={18} draw strokeWidth={2.6} className="-mt-0.5 ml-px" />}
      </span>
      <span>{label}</span>
    </label>
  );
}

/** Renders one question's answer control. Pure/controlled. */
interface QuestionFieldProps {
  question: Question;
  number: number;
  /** Stored answers are untyped JSON; each control narrows what it reads. */
  value: unknown;
  onChange: (value: AnswerValue | undefined) => void;
  error?: string;
  disabled?: boolean;
}

export default function QuestionField({ question: q, number, value, onChange, error, disabled }: QuestionFieldProps) {
  const options = q.options ?? [];
  const picked = Array.isArray(value) ? (value as string[]) : [];
  const rating = typeof value === 'number' ? value : 0;
  const fieldId = `f_${q.id}`;
  const describedBy = [q.description && `${fieldId}_desc`, error && `${fieldId}_err`].filter(Boolean).join(' ') || undefined;

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" aria-describedby={describedBy} disabled={disabled}>
      <legend className="mb-4 flex gap-3 p-0 text-[17px]/6 font-medium">
        <span className="min-w-4 flex-none font-mono text-[13px]/6 font-normal text-muted">{number}</span>
        <span>
          {q.label || <span className="text-muted">Untitled question</span>}
          {q.required && (
            <span className="font-normal text-danger" aria-label="required">
              {' '}
              *
            </span>
          )}
        </span>
      </legend>
      {q.description && (
        <p id={`${fieldId}_desc`} className={`-mt-2 mb-4 text-sm/5 text-fg-2 ${INDENT}`}>
          {q.description}
        </p>
      )}

      {q.type === 'text' && (
        <TextAnswer
          q={q}
          id={fieldId}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          invalid={Boolean(error)}
        />
      )}

      {q.type === 'single' && (
        <div className={`flex flex-col gap-2 ${INDENT}`} role="radiogroup">
          {options.map((o) => (
            <Choice
              key={o.id}
              type="radio"
              name={fieldId}
              checked={value === o.id}
              onChange={() => onChange(o.id)}
              label={o.label}
            />
          ))}
          {typeof value === 'string' && value && !q.required && (
            <button type="button" className="link-btn mt-1 self-start text-[13px]" onClick={() => onChange(undefined)}>
              Clear selection
            </button>
          )}
        </div>
      )}

      {q.type === 'multi' && (
        <div className={`flex flex-col gap-2 ${INDENT}`}>
          {options.map((o) => {
            const checked = picked.includes(o.id);
            return (
              <Choice
                key={o.id}
                type="checkbox"
                name={`${fieldId}_${o.id}`}
                checked={checked}
                label={o.label}
                onChange={() => {
                  const next = checked ? picked.filter((x) => x !== o.id) : [...picked, o.id];
                  onChange(next.length ? next : undefined);
                }}
              />
            );
          })}
        </div>
      )}

      {q.type === 'rating' && (
        <div className={INDENT}>
          <div className="flex gap-2" role="radiogroup" aria-label={q.label}>
            {[1, 2, 3, 4, 5].map((n) => {
              const current = rating === n;
              const on = rating >= n;
              return (
                <button
                  type="button"
                  key={n}
                  role="radio"
                  aria-checked={current}
                  aria-label={`${n}, ${RATING_HINTS[n]}`}
                  className={`inline-grid size-12 place-items-center rounded-md border font-mono text-[15px] font-medium transition-[background-color,border-color,color] duration-150 ease-gf active:scale-[0.97] max-sm:size-11 ${
                    current
                      ? 'border-accent bg-accent text-accent-ink'
                      : on
                        ? 'border-accent-line bg-accent-soft text-accent'
                        : 'border-line-strong bg-surface text-fg-2 hover:border-accent-line hover:text-fg'
                  }`}
                  onClick={() => onChange(rating === n && !q.required ? undefined : n)}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex max-w-68 justify-between text-[13px]/5 text-muted">
            <span>{RATING_HINTS[1]}</span>
            <span className="text-fg-2">{rating ? RATING_HINTS[rating] : ''}</span>
            <span>{RATING_HINTS[5]}</span>
          </div>
        </div>
      )}

      {error && (
        <p id={`${fieldId}_err`} className={`field-error ${INDENT}`} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

interface TextAnswerProps {
  q: Question;
  id: string;
  value: string;
  onChange: (value: string | undefined) => void;
  invalid: boolean;
}

function TextAnswer({ q, id, value, onChange, invalid }: TextAnswerProps) {
  const max = q.maxLength ?? LIMITS.defaultTextMaxLength;
  const props = {
    id,
    value,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value === '' ? undefined : e.target.value),
    maxLength: max,
    'aria-invalid': invalid || undefined,
    placeholder: 'Your answer',
    className: invalid ? 'border-danger' : '',
  };
  const len = value.length;
  return (
    <div className={`relative ${INDENT}`}>
      {q.multiline ? <textarea rows={4} {...props} /> : <input type="text" {...props} />}
      {len > max * 0.8 && (
        <span className="absolute right-2 -bottom-5 font-mono text-xs text-muted">
          {len}/{max}
        </span>
      )}
    </div>
  );
}
