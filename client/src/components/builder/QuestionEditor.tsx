import {
  type Question,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  type QuestionType,
  type SchemaError,
  describeCondition,
  makeId,
} from '@survey/shared';
import type { DragEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CircleDot,
  Copy,
  GripVertical,
  ListChecks,
  MoreHorizontal,
  Plus,
  Star,
  Trash2,
  Type,
} from 'lucide-react';
import Select from '../common/Select';
import Menu from '../common/Menu';
import Switch from '../common/Switch';
import { plural } from '../../lib/questionOps';
import OptionsEditor from './OptionsEditor';
import ConditionEditor, { defaultConditionFor } from './ConditionEditor';

const TYPE_ICONS: Record<QuestionType, typeof Type> = { text: Type, single: CircleDot, multi: ListChecks, rating: Star };

export interface DragHandlers {
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
  onDragEnd: () => void;
}
const I = { size: 16, strokeWidth: 1.5, 'aria-hidden': true };

/** Switching type keeps label/required/condition, adds or drops type-specific fields. */
function withType(q: Question, type: QuestionType): Question {
  const next: Question = { ...q, type };
  if (type === 'single' || type === 'multi') {
    next.options = q.options?.length
      ? q.options
      : [
          { id: makeId('o'), label: 'Option 1' },
          { id: makeId('o'), label: 'Option 2' },
        ];
  } else {
    delete next.options;
  }
  if (type !== 'text') {
    delete next.multiline;
    delete next.maxLength;
  }
  return next;
}

interface QuestionHeaderProps {
  q: Question;
  index: number;
  total: number;
  questions: Question[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onMove: (dir: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  dragHandlers: DragHandlers;
}

function QuestionHeader({
  q,
  index,
  total,
  questions,
  collapsed,
  onToggleCollapse,
  onMove,
  onDuplicate,
  onRemove,
  dragHandlers,
}: QuestionHeaderProps) {
  const TypeIcon = TYPE_ICONS[q.type];
  return (
    <div className="flex h-13 items-center gap-2 border-b border-line pr-3 pl-2 max-sm:h-auto max-sm:min-h-13 max-sm:flex-wrap max-sm:p-2">
      <span
        className="grid h-8 w-6 cursor-grab place-items-center text-muted select-none active:cursor-grabbing"
        draggable
        onDragStart={dragHandlers.onDragStart}
        onDragEnd={dragHandlers.onDragEnd}
        title="Drag to reorder"
        aria-hidden="true"
      >
        <GripVertical {...I} />
      </span>
      <span className="w-6 flex-none font-mono text-xs text-muted">Q{index + 1}</span>
      <span className="grid w-4 flex-none place-items-center text-muted" title={QUESTION_TYPE_LABELS[q.type]}>
        <TypeIcon {...I} />
      </span>
      <button
        type="button"
        className="block min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[15px] font-medium text-fg max-sm:basis-[calc(100%_-_120px)]"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
      >
        {q.label || <span className="text-muted">Untitled question</span>}
      </button>
      {q.condition && (
        <span className="chip chip-logic" title={describeCondition(q.condition, questions)}>
          Logic
        </span>
      )}
      {q.required && <span className="chip">Required</span>}
      <div className="flex flex-none max-sm:ml-auto">
        <Menu
          label={`More actions for question ${index + 1}`}
          trigger={<MoreHorizontal {...I} />}
          items={[
            { label: 'Move up', icon: <ArrowUp {...I} />, onSelect: () => onMove(-1), disabled: index === 0 },
            { label: 'Move down', icon: <ArrowDown {...I} />, onSelect: () => onMove(1), disabled: index === total - 1 },
            { separator: true },
            { label: 'Duplicate', icon: <Copy {...I} />, onSelect: onDuplicate },
          ]}
        />
        <button type="button" className="icon-btn icon-btn-danger" onClick={onRemove} aria-label="Delete question" title="Delete">
          <Trash2 {...I} />
        </button>
      </div>
    </div>
  );
}

export interface QuestionEditorProps {
  question: Question;
  index: number;
  questions: Question[];
  errors: SchemaError[];
  onChange: (next: Question, opts?: { typeChanged?: boolean }) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (dir: number) => void;
  dragHandlers: DragHandlers;
  isDragOver: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

/** One question in the builder: header (collapse, menu, delete) and its editable body. */
export default function QuestionEditor({
  question: q,
  index,
  questions,
  errors,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
  dragHandlers,
  isDragOver,
  collapsed,
  onToggleCollapse,
}: QuestionEditorProps) {
  const earlier = questions.slice(0, index);
  const set = (patch: Partial<Question>) => onChange({ ...q, ...patch });
  const hasErrors = errors.length > 0;

  return (
    <article
      className={`card p-0 transition-[border-color,box-shadow] duration-150 ease-gf focus-within:border-accent-line ${
        isDragOver
          ? 'border-accent ring-3 ring-accent-soft'
          : hasErrors
            ? 'border-[color-mix(in_srgb,var(--danger)_40%,transparent)]'
            : ''
      }`}
      onDragOver={dragHandlers.onDragOver}
      onDrop={dragHandlers.onDrop}
      onDragLeave={dragHandlers.onDragLeave}
      aria-label={`Question ${index + 1}`}
    >
      <QuestionHeader
        q={q}
        index={index}
        total={questions.length}
        questions={questions}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onMove={onMove}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
        dragHandlers={dragHandlers}
      />

      {!collapsed && (
        <div className="px-5 pt-5 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="field min-w-0 flex-1">
              <span>Question</span>
              <input
                value={q.label}
                onChange={(e) => set({ label: e.target.value })}
                placeholder="How satisfied are you with our service?"
                maxLength={500}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- focus the label of a question the admin just added
                autoFocus={!q.label}
              />
            </label>
            <div className="field min-w-44">
              <span id={`qt_${q.id}`}>Type</span>
              <Select
                aria-labelledby={`qt_${q.id}`}
                value={q.type}
                onChange={(type) => onChange(withType(q, type), { typeChanged: true })}
                options={QUESTION_TYPES.map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] }))}
              />
            </div>
          </div>

          <label className="field">
            <span>
              Help text <span className="font-normal text-muted">(optional)</span>
            </span>
            <input
              value={q.description ?? ''}
              onChange={(e) => set({ description: e.target.value || undefined })}
              placeholder="Extra context shown under the question"
              maxLength={1000}
            />
          </label>

          {(q.type === 'single' || q.type === 'multi') && (
            <OptionsEditor type={q.type} options={q.options ?? []} onChange={(options) => set({ options })} />
          )}

          {q.type === 'text' && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="m-0 size-4 accent-accent"
                  checked={Boolean(q.multiline)}
                  onChange={(e) => set({ multiline: e.target.checked })}
                />
                Long answer (paragraph)
              </label>
              <label className="field mb-0">
                <span>Max length</span>
                <input
                  type="number"
                  className="w-28"
                  min={1}
                  max={10000}
                  value={q.maxLength ?? ''}
                  placeholder="2000"
                  onChange={(e) => set({ maxLength: e.target.value ? Number(e.target.value) : undefined })}
                />
              </label>
            </div>
          )}

          {q.type === 'rating' && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-muted" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className="inline-grid size-8 place-items-center rounded-md border border-line-strong bg-surface font-mono text-[13px] font-medium text-fg-2"
                >
                  {n}
                </span>
              ))}
              <span className="text-[13px]/5">Respondents pick 1 (very poor) – 5 (excellent)</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <Switch checked={q.required} onChange={(required) => set({ required })}>
              Required
            </Switch>
            {!q.condition && (
              <button
                type="button"
                className="link-btn"
                disabled={earlier.length === 0}
                title={earlier.length === 0 ? 'Conditions can only depend on earlier questions' : undefined}
                onClick={() => {
                  const parent = earlier[earlier.length - 1];
                  if (parent) set({ condition: defaultConditionFor(parent) });
                }}
              >
                <Plus {...I} /> Add display condition
              </button>
            )}
          </div>

          {q.condition && (
            <ConditionEditor
              condition={q.condition}
              questions={questions}
              index={index}
              onChange={(condition) => set({ condition })}
            />
          )}

          {hasErrors && (
            <ul className="mt-4 rounded-md bg-danger-soft py-2 pr-3 pl-7 text-[13px]/5 text-danger">
              {errors.map((e) => {
                const msg = e.message.replace(/^Question \d+,?\s*/, '');
                return <li key={`${e.path}-${e.message}`}>{msg.charAt(0).toUpperCase() + msg.slice(1)}</li>;
              })}
            </ul>
          )}
        </div>
      )}
      {collapsed && hasErrors && (
        <p className="mx-3 mb-3 rounded-md bg-danger-soft px-3 py-2 text-[13px]/5 text-danger">
          {errors.length} {plural(errors.length, 'issue')}, expand to fix
        </p>
      )}
    </article>
  );
}
