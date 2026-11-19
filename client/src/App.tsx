import { type ReactNode, Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import ErrorBoundary from './components/common/ErrorBoundary';
import Spinner from './components/common/Spinner';

// Each route is its own chunk, loaded on first visit.
const AdminLayout = lazy(() => import('./components/layout/AdminLayout'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AllSurveys = lazy(() => import('./pages/AllSurveys'));
const Builder = lazy(() => import('./pages/Builder'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner page />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Spinner page />}>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="surveys" element={<AllSurveys />} />
            <Route path="surveys/:id/edit" element={<Builder />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
