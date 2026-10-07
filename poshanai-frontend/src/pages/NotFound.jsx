import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream p-6 text-center dark:bg-slate-950">
      <p className="text-sm font-semibold text-leaf">404</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Page not found</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-300">
        The page you requested could not be found.
      </p>
      <Link className="mt-6 rounded-lg bg-leaf px-5 py-3 font-semibold text-white" to="/">
        Back to home
      </Link>
    </main>
  );
}
