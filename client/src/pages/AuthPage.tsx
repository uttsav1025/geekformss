import { type ChangeEvent, type FormEvent, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { errorMessage } from '../lib/api';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { type AuthMode, useAuth } from '../lib/auth';
import Logo from '../components/common/Logo';
import ThemeToggle from '../components/common/ThemeToggle';

const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === 'true';

type Field = 'name' | 'email' | 'password';

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const { user, authenticate } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isRegister = mode === 'register';
  const navState = location.state as { from?: string } | null;
  const dest = navState?.from ?? '/admin';

  if (user) return <Navigate to={dest} replace />;

  const set = (k: Field) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = isRegister ? form : { email: form.email, password: form.password };
      await authenticate(mode, payload);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center p-4 max-sm:block max-sm:pt-4">
      <div className="fixed top-4 right-4 max-sm:static max-sm:mx-auto max-sm:mb-3 max-sm:flex max-sm:max-w-100 max-sm:justify-end">
        <ThemeToggle />
      </div>
      <form className="card w-full max-w-100 p-6 max-sm:mx-auto max-sm:p-5" onSubmit={(e) => void submit(e)} noValidate>
        <div className="mb-6 [&_h1]:mb-1 [&_h1]:text-2xl [&_p]:m-0 [&>span:first-child]:mb-4">
          <Logo size={24} withName />
          <h1>{isRegister ? 'Create a GeekForms account' : 'Log in to GeekForms'}</h1>
          <p className="text-fg-2">
            {isRegister ? 'Write a survey, share one link, read the answers' : 'Your surveys and their results'}
          </p>
        </div>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        {isRegister && (
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={set('name')} autoComplete="name" required />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
        </label>
        <label className="field">
          <span>Password</span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              className="pr-10"
              required
            />
            <button
              type="button"
              className="icon-btn absolute top-1/2 right-1 -translate-y-1/2"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            </button>
          </div>
          {isRegister && <small className="text-muted">At least 8 characters</small>}
        </label>
        <button className="btn btn-primary mt-2 mb-4 w-full" disabled={busy}>
          {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
        </button>
        {/* Demo credentials only in development, or when a demo build opts in. */}
        {!isRegister && SHOW_DEMO && (
          <p className="mb-2 text-center text-[13px] text-muted">
            Demo account <code>demo@geekforms.dev</code> · <code>demo12345</code>
          </p>
        )}
        <p className="m-0 text-center text-[13px] text-muted">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <Link to="/login" state={navState}>
                Log in
              </Link>
            </>
          ) : (
            <>
              New here?{' '}
              <Link to="/register" state={navState}>
                Create an account
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
