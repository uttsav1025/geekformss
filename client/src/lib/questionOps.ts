import { type Question, makeId } from '@survey/shared';

/** Remove conditions that point at the given question id. Returns [questions, clearedCount]. */
export function clearDependents(questions: Question[], qid: string): [Question[], number] {
  let cleared = 0;
  const next = questions.map((q) => {
    if (q.condition?.questionId === qid) {
      cleared += 1;
      return { ...q, condition: null };
    }
    return q;
  });
  return [next, cleared];
}

/** A deep copy with fresh question/option ids, inserted right after the original. */
export function duplicateAt(questions: Question[], index: number): Question[] {
  const src = questions[index];
  if (!src) return questions;
  const copy: Question = {
    ...structuredClone(src),
    id: makeId('q'),
    label: src.label ? `${src.label} (copy)` : '',
    options: src.options?.map((o) => ({ ...o, id: makeId('o') })),
    condition: src.condition ? { ...src.condition } : null,
  };
  if (!copy.options) delete copy.options;
  const out = [...questions];
  out.splice(index + 1, 0, copy);
  return out;
}

/** Move one item; out-of-range targets return the list unchanged. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const out = [...list];
  const [item] = out.splice(from, 1);
  if (item !== undefined) out.splice(to, 0, item);
  return out;
}

export const plural = (n: number, one: string, many = `${one}s`): string => (n === 1 ? one : many);
