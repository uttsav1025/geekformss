/**
 * The GeekForms signature: a pen tick, drawn the way you'd tick a paper form.
 * Slightly uneven strokes so it reads as handwriting, not a UI checkmark.
 * `draw` animates the stroke in once (used when a choice is selected).
 */
interface InkTickProps {
  size?: number;
  draw?: boolean;
  className?: string;
  strokeWidth?: number;
  /** Accessible name; without it the tick is decorative. */
  title?: string;
}

export default function InkTick({ size = 16, draw = false, className = '', strokeWidth = 2.4, title }: InkTickProps) {
  return (
    <svg
      className={`ink-tick block flex-none text-accent ${draw ? 'ink-draw' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path
        d="M4.2 13.1c1.9 1 3.5 2.6 4.7 5.1C11.6 11.9 15.2 7.5 20.2 4.4"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
      />
    </svg>
  );
}
