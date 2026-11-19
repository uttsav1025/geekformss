import { QUESTION_TYPES, QUESTION_TYPE_LABELS, type QuestionType } from '@survey/shared';
import { Plus } from 'lucide-react';

/** Dashed card at the end of the list: one button per question type. */
export default function AddQuestionCard({ onAdd }: { onAdd: (type: QuestionType) => void }) {
  return (
    <div className="card flex flex-col gap-3 border-dashed bg-transparent px-6 py-5 shadow-none">
      <span className="text-muted">Add a question</span>
      <div className="flex flex-wrap gap-2">
        {QUESTION_TYPES.map((t) => (
          <button key={t} className="btn" onClick={() => onAdd(t)}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" /> {QUESTION_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
