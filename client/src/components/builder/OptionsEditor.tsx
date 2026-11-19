import { type Option, makeId } from '@survey/shared';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';

const I = { size: 16, strokeWidth: 1.5, 'aria-hidden': true };

/** Answer options for a choice question: edit, reorder, add (Enter adds the next), remove (min 2). */
interface OptionsEditorProps {
  type: 'single' | 'multi';
  options: Option[];
  onChange: (options: Option[]) => void;
}

export default function OptionsEditor({ type, options, onChange }: OptionsEditorProps) {
  const setLabel = (i: number, label: string) => onChange(options.map((o, j) => (j === i ? { ...o, label } : o)));
  const add = () => onChange([...options, { id: makeId('o'), label: `Option ${options.length + 1}` }]);
  const remove = (i: number) => onChange(options.filter((_, j) => j !== i));
  const move = (i: number, dir: number) => {
    const j = i + dir;
    const a = options[i];
    const b = options[j];
    if (!a || !b) return;
    const next = [...options];
    next[i] = b;
    next[j] = a;
    onChange(next);
  };

  return (
    <div className="mb-4">
      <span className="field-label mb-1 block">Options</span>
      {options.map((o, i) => (
        <div key={o.id} className="mb-2 flex items-center gap-1">
          <span
            className={`mr-2 ml-1 size-4 flex-none border-[1.5px] border-line-strong ${type === 'single' ? 'rounded-full' : 'rounded-[4px]'}`}
            aria-hidden="true"
          />
          <input
            value={o.label}
            onChange={(e) => setLabel(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            className="mr-1"
            aria-label={`Option ${i + 1}`}
            maxLength={200}
          />
          <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move option up">
            <ArrowUp {...I} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => move(i, 1)}
            disabled={i === options.length - 1}
            aria-label="Move option down"
          >
            <ArrowDown {...I} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-danger"
            onClick={() => remove(i)}
            disabled={options.length <= 2}
            aria-label="Remove option"
          >
            <X {...I} />
          </button>
        </div>
      ))}
      <button type="button" className="link-btn" onClick={add}>
        <Plus {...I} /> Add option
      </button>
    </div>
  );
}
