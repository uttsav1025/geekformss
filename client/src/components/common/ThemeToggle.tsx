import { Monitor, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { type Theme, useTheme } from '../../lib/theme';

const OPTIONS: { value: Theme; label: string; Icon: LucideIcon }[] = [
  { value: 'system', label: 'Match system', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

/** Three-way theme switch: system, light, dark. */
export default function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="inline-flex gap-0.5 rounded-md bg-raised p-0.5" role="radiogroup" aria-label="Color theme">
      {OPTIONS.map(({ value, label, Icon }) => {
        const on = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            className={`grid size-7 place-items-center rounded-sm border-0 transition-[background-color,color] duration-150 ease-gf hover:text-fg ${
              on ? 'bg-surface text-fg shadow-soft' : 'bg-transparent text-muted'
            }`}
            onClick={() => setTheme(value)}
          >
            <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
