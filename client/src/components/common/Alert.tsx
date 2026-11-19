import type { ReactNode } from 'react';

type Tone = 'error' | 'success' | 'info';
const TONE: Record<Tone, string> = { error: 'alert-error', success: 'alert-success', info: '' };

/** Inline message box. */
export default function Alert({
  tone = 'info',
  children,
  className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`alert ${TONE[tone]} ${className}`} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  );
}
