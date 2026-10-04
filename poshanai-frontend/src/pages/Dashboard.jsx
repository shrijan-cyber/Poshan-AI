import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth.js';

const profileFields = [
  { label: 'Age', value: (profile) => profile.age ? `${profile.age} years` : null },
  { label: 'Gender', value: (profile) => profile.gender },
  {
    label: 'Diet preference',
    value: (profile) => ({
      veg: 'Vegetarian',
      'non-veg': 'Non-vegetarian',
      vegan: 'Vegan',
    })[profile.dietType],
  },
  { label: 'Weight', value: (profile) => profile.weightKg ? `${profile.weightKg} kg` : null },
  { label: 'Height', value: (profile) => profile.heightCm ? `${profile.heightCm} cm` : null },
  { label: 'Region', value: (profile) => profile.region },
];

const completionFields = ['name', 'age', 'gender', 'dietType', 'weightKg', 'heightCm'];
const completionWidths = ['w-0', 'w-1/6', 'w-2/6', 'w-3/6', 'w-4/6', 'w-5/6', 'w-full'];

function FeatureCard({ number, title, description }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 font-heading text-sm font-bold text-leaf dark:bg-emerald-900/40 dark:text-emerald-200" aria-hidden="true">
          {number}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Coming soon
        </span>
      </div>
      <h3 className="mt-6 font-heading text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
    </article>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const profile = user?.profile || {};
  const completedFields = completionFields.filter((field) => Boolean(profile[field])).length;
  const completion = Math.round((completedFields / completionFields.length) * 100);
  const displayName = profile.name?.trim().split(/\s+/)[0] || 'there';

  return (
    <main className="bg-cream px-4 py-8 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-[2rem] bg-leaf px-6 py-8 text-white shadow-sm sm:px-9 sm:py-10"
        >
          <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[32px] border-white/10" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-28 right-28 h-56 w-56 rounded-full bg-orange/20 blur-2xl" aria-hidden="true" />
          <div className="relative max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">Your nutrition space</p>
            <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome, {displayName}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50 sm:text-base">
              Keep your food preferences and profile details together as you explore nutrition awareness.
            </p>
          </div>
        </motion.header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]" aria-label="Profile overview">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf dark:text-emerald-300">Your profile</p>
                <h2 className="mt-2 font-heading text-2xl font-bold text-slate-900 dark:text-white">Personal details</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{user?.email}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-leaf dark:bg-emerald-900/40 dark:text-emerald-200">
                {completion}% complete
              </span>
            </div>

            <div
              className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
              role="progressbar"
              aria-label="Profile completeness"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completion}
            >
              <div className={`h-full rounded-full bg-leaf transition-[width] duration-500 dark:bg-emerald-400 ${completionWidths[completedFields]}`} />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Profile completeness is a setup indicator, not a health score.
            </p>

            <dl className="mt-7 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              {profileFields.map(({ label, value }) => (
                <div key={label} className="border-b border-slate-100 pb-4 dark:border-slate-800">
                  <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{value(profile) || 'Not added'}</dd>
                </div>
              ))}
            </dl>
          </article>

          <aside className="flex flex-col rounded-3xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40 sm:p-8" aria-labelledby="wellbeing-note-title">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-xl dark:bg-amber-900/40" aria-hidden="true">✳</span>
            <h2 id="wellbeing-note-title" className="mt-5 font-heading text-xl font-semibold text-amber-950 dark:text-amber-100">
              A note on your wellbeing
            </h2>
            <p className="mt-3 text-sm leading-6 text-amber-900 dark:text-amber-200">
              PoshanAI offers nutrition awareness and food suggestions. It does not diagnose or treat medical conditions.
            </p>
            <p className="mt-auto pt-6 text-sm font-medium leading-6 text-amber-950 dark:text-amber-100">
              For personal medical advice, speak with a qualified healthcare professional.
            </p>
          </aside>
        </section>

        <section className="mt-10" aria-labelledby="tools-title">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange">What’s next</p>
            <h2 id="tools-title" className="mt-2 font-heading text-2xl font-bold text-slate-900 dark:text-white">
              Your nutrition toolkit
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              These areas will become available as their services are completed.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <FeatureCard
              number="01"
              title="Reports"
              description="Secure report upload and nutrition-value review are not available yet."
            />
            <FeatureCard
              number="02"
              title="Meal ideas"
              description="Personalized meal planning is not available yet. No plans or nutrition results are shown until the service is ready."
            />
          </div>
        </section>
      </div>
    </main>
  );
}
