import { type ReactNode, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/** The element under the top bar that pages render their breadcrumbs into. */
export const PageBarSlot = createContext<HTMLElement | null>(null);

export interface Crumb {
  label: string;
  to?: string;
}

/**
 * Breadcrumbs (and optional page controls on the right) rendered into the bar
 * directly under the top bar. The last crumb is the current page.
 */
export default function PageBar({ crumbs, children }: { crumbs: Crumb[]; children?: ReactNode }) {
  const slot = useContext(PageBarSlot);
  if (!slot) return null;
  return createPortal(
    <div className="flex min-h-11 items-center justify-between gap-4">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="m-0 flex min-w-0 list-none items-center gap-1 p-0 text-sm/5">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            const middle = i > 0 && !last;
            return (
              <li
                key={`${i}-${c.label}`}
                className={`flex items-center gap-1 ${middle ? 'max-w-[40ch] min-w-0' : last ? 'min-w-0' : 'flex-none'}`}
              >
                {i > 0 && <ChevronRight size={14} strokeWidth={1.5} className="flex-none text-muted" aria-hidden="true" />}
                {last || !c.to ? (
                  <span
                    className={last ? 'truncate font-medium text-fg' : 'whitespace-nowrap text-fg-2'}
                    aria-current={last ? 'page' : undefined}
                  >
                    {c.label}
                  </span>
                ) : (
                  <Link
                    to={c.to}
                    className={`whitespace-nowrap text-fg-2 hover:text-fg hover:no-underline ${middle ? 'truncate' : ''}`}
                  >
                    {c.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {children && <div className="flex flex-none items-center gap-4">{children}</div>}
    </div>,
    slot,
  );
}
