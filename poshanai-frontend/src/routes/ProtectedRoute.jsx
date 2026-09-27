import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { Loader } from '../components/common/index.js';

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <main className="flex min-h-[60vh] items-center justify-center"><Loader label="Restoring your session" /></main>;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
}
