import {
  type Condition,
  OPERATORS_BY_TYPE,
  OPERATOR_LABELS,
  type Operator,
  type Question,
  QUESTION_TYPE_LABELS,
  VALUELESS_OPERATORS,
} from '@survey/shared';
import { X } from 'lucide-react';
import Select from '../common/Select';

const RATING_HINTS = ['Very poor', 'Poor', 'Okay', 'Good', 'Excellent'];

/** Sensible starting condition for a given trigger question. */
export function defaultConditionFor(parent: Question): Condition {
  const operator = OPERATORS_BY_TYPE[parent.type][0] ?? 'answered';
  let value: string | number | undefined;
  if (parent.type === 'single' || parent.type === 'multi') value = parent.options?.[0]?.id;
  else if (parent.type === 'rating') value = 4;
  return { questionId: parent.id, operator, value };
}

interface ConditionValueProps {
  parent: Question;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
}

function ConditionValue({ parent, value, onChange }: ConditionValueProps) {
  const options = parent.options ?? [];
  if (parent.type === 'single' || parent.type === 'multi') {
    return (
      <Select
        className="flex-[1_1_144px]"
        aria-label="Value"
        value={typeof value === 'string' && options.some((o) => o.id === value) ? value : undefined}
        placeholder="Choose an option"
        onChange={onChange}
        options={options.map((o) => ({ value: o.id, label: o.label || 'Untitled option' }))}
      />
    );
  }
  if (parent.type === 'rating') {
    return (
      <Select
        className="flex-[1_1_144px]"
        aria-label="Value"
        value={typeof value === 'number' ? value : 4}
        onChange={(v) => onChange(Number(v))}
        options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n), hint: RATING_HINTS[n - 1] }))}
      />
    );
  }
  return (
    <input
      className="w-auto min-w-0 flex-[1_1_144px]"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Answer text"
      aria-label="Value"
    />
  );
}

/**
 * "Show this question only if …" — trigger question, operator, value.
 * Only earlier questions can be triggers; a trigger that now comes later is
 * shown, disabled, so the admin sees why the condition is invalid.
 */
interface ConditionEditorProps {
  condition: Condition;
  questions: Question[];
  index: number;
  onChange: (condition: Condition | null) => void;
}

export default function ConditionEditor({ condition, questions, index, onChange }: ConditionEditorProps) {
  const earlier = questions.slice(0, index);
  const parent = questions.find((x) => x.id === condition.questionId) ?? null;
  const patch = (p: Partial<Condition>) => onChange({ ...condition, ...p });

  return (
    <div className="mt-4 rounded-md border border-accent-line bg-accent-soft px-4 py-3">
      <span className="mb-2 block text-[13px] font-medium text-accent">Show this question only if</span>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="flex-[2_1_200px]"
          aria-label="Trigger question"
          value={condition.questionId}
          onChange={(qid) => {
            const p = questions.find((x) => x.id === qid);
            if (p) onChange(defaultConditionFor(p));
          }}
          options={[
            ...(!parent ? [{ value: condition.questionId, label: '(missing question)', disabled: true }] : []),
            ...earlier.map((p) => ({
              value: p.id,
              label: `Q${questions.indexOf(p) + 1}. ${p.label ? p.label.slice(0, 60) : 'Untitled'}`,
              hint: QUESTION_TYPE_LABELS[p.type],
            })),
            ...(parent && !earlier.includes(parent)
              ? [
                  {
                    value: parent.id,
                    label: `Q${questions.indexOf(parent) + 1}. ${parent.label}`,
                    hint: 'Comes later, move it above',
                    disabled: true,
                  },
                ]
              : []),
          ]}
        />
        {parent && (
          <Select
            className="flex-[1_1_144px]"
            aria-label="Operator"
            value={condition.operator}
            onChange={(operator: Operator) => patch({ operator })}
            options={OPERATORS_BY_TYPE[parent.type].map((op) => ({ value: op, label: OPERATOR_LABELS[op] }))}
          />
        )}
        {parent && !VALUELESS_OPERATORS.has(condition.operator) && (
          <ConditionValue parent={parent} value={condition.value} onChange={(value) => patch({ value })} />
        )}
        <button type="button" className="icon-btn icon-btn-danger" onClick={() => onChange(null)} aria-label="Remove condition">
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
