import { Suspense, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useCreateSurvey } from '../../hooks/useCreateSurvey';
import Logo from '../common/Logo';
import AccountMenu from './AccountMenu';
import ThemeToggle from '../common/ThemeToggle';
import Spinner from '../common/Spinner';
import { PageBarSlot } from '../common/PageBar';

// Header rows align their content with the 1240px page container (32px gutter,
// 16px on phones), so the logo, crumbs and cards share one left edge.
const GUTTER = '[--gutter:max(32px,calc((100%_-_1240px)/2_+_32px))] max-sm:[--gutter:16px] px-[var(--gutter)]';

const navLink = ({ isActive }: { isActive: boolean }) =>
  [
    'relative inline-flex h-full items-center px-3 text-sm font-medium whitespace-nowrap no-underline transition-colors duration-150 ease-gf hover:text-fg hover:no-underline',
    // Location, not a control: an accent rule on the bar's bottom edge.
    "after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent after:transition-transform after:duration-180 after:ease-gf after:content-['']",
    'max-sm:h-11 max-sm:flex-1 max-sm:justify-center max-sm:after:inset-x-0',
    isActive ? 'text-fg after:scale-x-100' : 'text-muted after:scale-x-0',
  ].join(' ');

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { create, creating, error } = useCreateSurvey();
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Publish the sticky header height as --hdr so the reserved scrollbar lane
  // can be painted to match the header instead of notching it.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return undefined;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty('--hdr', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--hdr');
    };
  }, []);

  return (
    <div>
      <div className="app-header sticky top-0 z-20 border-b border-line bg-surface" ref={headerRef}>
        {/* Three columns: brand | centred nav | actions. Phones: logo row, then full-width tabs. */}
        <header
          className={`grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-4 ${GUTTER} max-sm:flex max-sm:h-auto max-sm:flex-wrap max-sm:gap-0 max-sm:pt-3`}
        >
          <Link to="/admin" className="justify-self-start hover:no-underline max-sm:mr-auto" aria-label="GeekForms home">
            <Logo withName />
          </Link>
          <nav
            className="flex gap-2 self-stretch max-sm:order-3 max-sm:-mx-[var(--gutter)] max-sm:mt-3 max-sm:basis-[calc(100%_+_2*var(--gutter))] max-sm:gap-0 max-sm:self-auto max-sm:border-t max-sm:border-line max-sm:px-[var(--gutter)]"
            aria-label="Main"
          >
            <NavLink to="/admin" end className={navLink}>
              Home
            </NavLink>
            <NavLink to="/admin/surveys" className={navLink}>
              All surveys
            </NavLink>
          </nav>
          <div className="flex items-center gap-3 justify-self-end text-sm max-sm:gap-2">
            <button className="btn btn-primary btn-sm" onClick={() => void create()} disabled={creating} aria-label="New survey">
              <Plus size={16} strokeWidth={1.5} aria-hidden="true" /> <span className="max-sm:hidden">New survey</span>
            </button>
            <ThemeToggle />
            <span className="h-5 w-px bg-line-strong max-sm:hidden" aria-hidden="true" />
            {user && <AccountMenu user={user} onLogout={() => void logout()} />}
          </div>
        </header>
        {/* Pages portal their breadcrumbs here; hidden while empty. */}
        <div className={`border-t border-line empty:hidden ${GUTTER}`} ref={setSlot} />
      </div>
      {error && (
        <div className="mx-auto max-w-[1240px] px-8 pt-8 max-sm:px-4">
          <div className="rounded-md border border-line bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>
        </div>
      )}
      <PageBarSlot.Provider value={slot}>
        <main className="mx-auto max-w-[1240px] px-8 pt-8 pb-16 max-sm:px-4 max-sm:pt-6 max-sm:pb-12">
          {/* Page chunks load inside the shell, so the header never blinks out. */}
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </PageBarSlot.Provider>
    </div>
  );
}
