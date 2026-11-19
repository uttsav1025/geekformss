import type { SaveState } from '../../types/ui';

const DOT: Record<SaveState, string> = { saved: 'bg-positive', dirty: 'bg-warn', saving: 'bg-warn', error: 'bg-danger' };
const LABEL: Record<SaveState, string> = {
  saved: 'All changes saved',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Save failed, retrying on next edit',
};

/** Autosave indicator: a coloured dot plus a short phrase, announced politely. */
export default function SaveStatus({ state, className = '' }: { state: SaveState; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[13px] text-muted ${className}`} aria-live="polite">
      <span className={`size-1.5 rounded-full ${DOT[state]}`} aria-hidden="true" />
      {LABEL[state]}
    </span>
  );
}
