import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Catches render errors below it so one broken screen doesn't blank the app.
 * Also covers a lazy route chunk that fails to load (e.g. after a deploy).
 */
export default class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-[60vh] place-items-center p-4">
        <div className="card max-w-110 p-6 text-center">
          <h2 className="mb-2">Something went wrong</h2>
          <p className="mb-4 text-fg-2">This screen failed to load. Reloading usually fixes it</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
