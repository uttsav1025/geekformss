import { type DragEvent, useState } from 'react';
import { type Question, type QuestionType, type SchemaError, createQuestion } from '@survey/shared';
import type { Flash } from '../../types/ui';
import type { DragHandlers } from './QuestionEditor';

interface QuestionListProps {
  questions: Question[];
  setQuestions: (fn: (qs: Question[]) => Question[]) => void;
  errorsByQuestion: Record<string, SchemaError[]>;
  isPublished: boolean;
  flash: Flash;
}
import { useConfirm } from '../common/ConfirmDialog';
import { clearDependents, duplicateAt, moveItem, plural } from '../../lib/questionOps';
import QuestionEditor from './QuestionEditor';
import AddQuestionCard from './AddQuestionCard';

/**
 * The editable list of questions: collapse/expand, drag and menu reordering,
 * duplicate, delete (with confirmation and dependent-condition cleanup), add.
 *
 * `setQuestions(fn)` applies a change to the draft (and schedules autosave).
 */
export default function QuestionList({ questions, setQuestions, errorsByQuestion, isPublished, flash }: QuestionListProps) {
  // Big surveys open collapsed for an overview.
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    questions.length > 6 ? new Set(questions.map((q) => q.id)) : new Set(),
  );
  const [drag, setDrag] = useState<{ from: number | null; over: number | null }>({ from: null, over: null });
  const confirm = useConfirm();

  const addQuestion = (type: QuestionType) => {
    const q = createQuestion(type);
    setQuestions((qs) => [...qs, q]);
    setTimeout(() => document.getElementById(`qe_${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const changeQuestion = (index: number, next: Question, { typeChanged = false }: { typeChanged?: boolean } = {}) => {
    setQuestions((qs) => {
      let out = qs.map((q, i) => (i === index ? next : q));
      if (typeChanged) {
        const [cleared, n] = clearDependents(out, next.id);
        out = cleared;
        if (n) flash('info', `Cleared ${n} ${plural(n, 'condition')} that depended on this question's old type`);
      }
      return out;
    });
  };

  const removeQuestion = async (index: number) => {
    const q = questions[index];
    if (!q) return;
    // A blank question someone just added goes without ceremony.
    if (q.label.trim()) {
      const dependents = questions.filter((x) => x.condition?.questionId === q.id).length;
      const ok = await confirm({
        title: `Delete question ${index + 1}?`,
        message: (
          <>
            <p>“{q.label}” is removed from the draft.</p>
            {dependents > 0 && (
              <p>
                {dependents} {plural(dependents, 'question uses', 'questions use')} it as a display condition. Those conditions
                are removed too.
              </p>
            )}
            {isPublished && <p>Published versions and their responses are not affected until you publish again.</p>}
          </>
        ),
        confirmLabel: 'Delete question',
      });
      if (!ok) return;
    }
    setQuestions((qs) => {
      const [out, n] = clearDependents(
        qs.filter((_, i) => i !== index),
        q.id,
      );
      if (n) flash('info', `Removed ${n} ${plural(n, 'condition')} that depended on the deleted question`);
      return out;
    });
  };

  const move = (from: number, to: number) => setQuestions((qs) => moveItem(qs, from, to));

  const toggleCollapse = (qid: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(qid)) n.delete(qid);
      else n.add(qid);
      return n;
    });

  const dragHandlers = (index: number): DragHandlers => ({
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      setDrag({ from: index, over: null });
    },
    onDragOver: (e: DragEvent) => {
      if (drag.from === null) return;
      e.preventDefault();
      if (drag.over !== index) setDrag((d) => ({ ...d, over: index }));
    },
    onDragLeave: () => {},
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (drag.from !== null) move(drag.from, index);
      setDrag({ from: null, over: null });
    },
    onDragEnd: () => setDrag({ from: null, over: null }),
  });

  return (
    <>
      {questions.length > 1 && (
        <div className="flex items-center gap-4 px-1">
          <span className="text-[13px] text-muted">{questions.length} questions</span>
          <button className="link-btn text-[13px]" onClick={() => setCollapsed(new Set(questions.map((q) => q.id)))}>
            Collapse all
          </button>
          <button className="link-btn text-[13px]" onClick={() => setCollapsed(new Set())}>
            Expand all
          </button>
        </div>
      )}

      {questions.map((q, i) => (
        <div key={q.id} id={`qe_${q.id}`}>
          <QuestionEditor
            question={q}
            index={i}
            questions={questions}
            errors={errorsByQuestion[q.id] ?? []}
            onChange={(next, opts) => changeQuestion(i, next, opts)}
            onRemove={() => void removeQuestion(i)}
            onDuplicate={() => setQuestions((qs) => duplicateAt(qs, i))}
            onMove={(dir) => move(i, i + dir)}
            dragHandlers={dragHandlers(i)}
            isDragOver={drag.over === i && drag.from !== i}
            collapsed={collapsed.has(q.id)}
            onToggleCollapse={() => toggleCollapse(q.id)}
          />
        </div>
      ))}

      <AddQuestionCard onAdd={addQuestion} />
    </>
  );
}
