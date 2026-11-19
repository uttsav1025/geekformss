import { type ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}
export type Confirm = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * App-wide confirmation dialog. `const confirm = useConfirm();` then
 * `if (await confirm({ title, message, confirmLabel })) { ...delete... }`.
 *
 * Built on the native <dialog> element: showModal() gives a real modal (focus
 * kept inside, page behind inert, Esc closes) without a focus-trap library.
 * Focus lands on Cancel, so a stray Enter never confirms a destructive action,
 * and returns to whatever opened the dialog when it closes.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Required<ConfirmOptions> | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const returnFocusRef = useRef<Element | null>(null);

  const confirm: Confirm = useCallback((opts: ConfirmOptions) => {
    returnFocusRef.current = document.activeElement;
    setReq({ confirmLabel: 'Delete', tone: 'danger', ...opts });
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const finish = useCallback((ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    dialogRef.current?.close();
    setReq(null);
    // Return focus to the trigger if it still exists, e.g. a row that was not deleted.
    const el = returnFocusRef.current;
    if (el instanceof HTMLElement && document.contains(el)) el.focus();
  }, []);

  useEffect(() => {
    const d = dialogRef.current;
    if (req && d && !d.open) {
      d.showModal();
      cancelRef.current?.focus();
    }
  }, [req]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {/* Backdrop click closes; Esc is handled natively by <dialog>. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={dialogRef}
        className="confirm m-auto w-[min(440px,calc(100vw_-_32px))] rounded-lg border border-line-strong bg-surface p-0 text-fg shadow-float"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        onCancel={(e) => {
          e.preventDefault();
          finish(false);
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) finish(false);
        }}
      >
        {req && (
          <div className="grid grid-cols-[36px_1fr] gap-4 p-6">
            <div className="grid size-9 place-items-center rounded-full bg-danger-soft text-danger" aria-hidden="true">
              <AlertTriangle size={18} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h2 id="confirm-title" className="mt-1.5 mb-2 text-[17px]/6 [overflow-wrap:anywhere]">
                {req.title}
              </h2>
              <div id="confirm-body" className="text-sm/5 text-fg-2 [&_p]:mb-2 [&_p:last-child]:mb-0">
                {req.message}
              </div>
            </div>
            <div className="col-span-full mt-2 flex justify-end gap-2">
              <button ref={cancelRef} type="button" className="btn" onClick={() => finish(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${req.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => finish(true)}
              >
                {req.confirmLabel}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
