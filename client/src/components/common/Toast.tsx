import type { Notice, NoticeKind } from '../../types/ui';

const TONE: Partial<Record<NoticeKind, string>> = { error: 'alert-error', success: 'alert-success' };

/** Transient status message pinned to the bottom of the viewport. */
export default function Toast({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <div
      className={`alert fixed bottom-6 left-1/2 z-50 mb-0 max-w-[calc(100vw_-_32px)] -translate-x-1/2 animate-toast-in shadow-float ${TONE[notice.kind] ?? ''}`}
      role="status"
    >
      {notice.text}
    </div>
  );
}
