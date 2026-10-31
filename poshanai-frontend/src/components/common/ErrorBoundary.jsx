import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-paper p-6 font-sans text-ink dark:bg-slate-950 dark:text-slate-100">
          <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-lg shadow-forest/10 dark:border-slate-700 dark:bg-slate-900">
            <h1 className="mb-4 text-2xl font-bold text-forest dark:text-emerald-200">The page hit a problem</h1>
            <p className="mb-6 text-slate-600 dark:text-slate-300">Reload PoshanAI to try again.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-forest px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-deepForest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2"
            >
              Reload page
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
