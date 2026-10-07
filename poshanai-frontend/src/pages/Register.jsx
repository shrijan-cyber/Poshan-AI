import { Link } from 'react-router-dom';

export default function Register() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream p-6 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm dark:bg-slate-900">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Register</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Create your PoshanAI account.</p>
        <form className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Name
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
              type="text"
              autoComplete="name"
            />
          </label>
          <label className="block text-sm font-medium">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
              type="email"
              autoComplete="email"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
              type="password"
              autoComplete="new-password"
            />
          </label>
          <button
            className="w-full rounded-lg bg-leaf px-4 py-3 font-semibold text-white"
            type="button"
          >
            Create account
          </button>
        </form>
        <p className="mt-5 text-sm text-slate-600 dark:text-slate-300">
          Already registered?{' '}
          <Link className="text-leaf underline" to="/login">
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
