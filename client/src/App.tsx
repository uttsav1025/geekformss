import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/common/ErrorBoundary';
import Spinner from './components/common/Spinner';

// Each route is its own chunk, loaded on first visit.
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Spinner page />}>
        <Routes>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
