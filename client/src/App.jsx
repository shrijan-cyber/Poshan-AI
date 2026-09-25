export default function App() {
  return <main className="min-h-screen bg-cream px-5 py-8 text-slate-800 sm:px-10">
    <header className="mx-auto flex max-w-6xl items-center justify-between"><a href="/" className="text-xl font-bold text-leaf">PoshanAI</a><span className="rounded-full bg-white px-4 py-2 text-sm">Nutrition awareness</span></header>
    <section className="mx-auto grid max-w-6xl gap-10 py-20 md:grid-cols-2 md:items-center md:py-28">
      <div><p className="mb-4 font-semibold uppercase tracking-widest text-leaf">Nutrition, grounded in India</p><h1 className="text-4xl font-bold leading-tight sm:text-6xl">Small food choices. Better nutrition awareness.</h1><p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">PoshanAI is a starting point for personalized, culturally relevant nutrition planning. Connect your profile and reports as the platform grows.</p><a href="#about" className="mt-8 inline-flex rounded-xl bg-leaf px-6 py-3 font-semibold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-leaf focus:ring-offset-2">Explore the project</a></div>
      <aside className="rounded-3xl border border-emerald-100 bg-white p-8 shadow-sm"><p className="text-sm font-semibold text-leaf">DESIGNED FOR EVERYDAY FOOD</p><h2 className="mt-3 text-2xl font-bold">Your nutrition journey starts with context.</h2><p className="mt-4 leading-7 text-slate-600">Regional foods, dietary preferences, and reliable composition data will shape future recommendations.</p><p className="mt-8 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">PoshanAI provides nutrition awareness and suggestions. It does not diagnose, treat, or replace advice from a qualified healthcare professional.</p></aside>
    </section>
    <section id="about" className="mx-auto max-w-6xl border-t border-emerald-100 py-8 text-sm text-slate-500">PoshanAI project scaffold · Built for responsive access</section>
  </main>;
}
