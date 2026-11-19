/**
 * On/off switch. A real checkbox stays underneath (keyboard, forms, screen
 * readers); the visible track is drawn from its checked/focus state.
 */
import type { ReactNode } from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}

export default function Switch({ checked, onChange, children }: SwitchProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium select-none">
      <input
        type="checkbox"
        className="peer absolute size-px opacity-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className="relative h-5 w-8 rounded-[10px] bg-line-strong transition-colors duration-150 ease-gf peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-[0_1px_2px_rgba(0,0,0,0.2)] after:transition-transform after:duration-150 after:ease-gf after:content-[''] peer-checked:after:translate-x-3"
        aria-hidden="true"
      />
      {children}
    </label>
  );
}
