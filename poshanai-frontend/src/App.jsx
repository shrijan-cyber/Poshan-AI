import { Provider } from 'react-redux';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import { Loader } from './components/common/index.js';
import { store } from './store/index.js';
import Layout from './components/layout/Layout.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import { InView } from '@/components/ui/in-view.jsx';

function LandingPage() {
  return (
    <main className="min-h-[70vh] bg-cream px-5 py-8 text-slate-800 sm:px-10">
      <section className="mx-auto grid max-w-6xl gap-10 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <p className="mb-4 font-semibold uppercase tracking-widest text-leaf">Nutrition, grounded in India</p>
          <h1 className="text-4xl font-bold leading-tight sm:text-6xl">Small food choices. Better nutrition awareness.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">PoshanAI is a starting point for personalized, culturally relevant nutrition planning. Connect your profile and reports as the platform grows.</p>
          <Link to="/login" className="mt-8 inline-flex rounded-xl bg-leaf px-6 py-3 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2">Get started</Link>
        </div>
        <InView as="aside" once transition={{ duration: 0.25, ease: 'easeOut' }} variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }} className="rounded-3xl border border-emerald-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-leaf">DESIGNED FOR EVERYDAY FOOD</p>
          <h2 className="mt-3 text-2xl font-bold">Your nutrition journey starts with context.</h2>
          <p className="mt-4 leading-7 text-slate-600">Regional foods, dietary preferences, and reliable composition data will shape future recommendations.</p>
          <p className="mt-8 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">PoshanAI provides nutrition awareness and suggestions. It does not diagnose, treat, or replace advice from a qualified healthcare professional.</p>
        </InView>
      </section>
    </main>
  );
}

function DashboardPage() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <main className="flex min-h-screen items-center justify-center"><Loader label="Restoring your session" /></main>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <main className="bg-cream px-4 py-10 text-slate-800 sm:px-6">
      <section className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm sm:p-9">
        <h1 className="mt-10 text-3xl font-bold">Welcome{user.profile?.name ? `, ${user.profile.name}` : ''}</h1>
        <p className="mt-3 text-slate-600">Your nutrition awareness dashboard is ready for your profile and reports.</p>
        <p className="mt-8 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">PoshanAI provides nutrition awareness and suggestions. It does not diagnose or replace advice from a qualified healthcare professional.</p>
      </section>
    </main>
  );
}

function NotFoundPage() {
  return <main className="p-8 text-center"><h1 className="text-2xl font-bold">Page not found</h1><Link className="mt-4 inline-block text-leaf underline" to="/">Return home</Link></main>;
}

export default function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </Provider>
  );
}
