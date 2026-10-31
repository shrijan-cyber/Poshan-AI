export default function OnboardingProgress({ step, total, title }) {
  const current = step + 1;
  const progress = (current / total) * 100;
  return (
    <div>
      <p className="text-sm font-semibold text-leaf dark:text-emerald-300" aria-live="polite">
        Step {current} of {total}
        <span className="sr-only">: {title}</span>
      </p>
      <div
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={`Step ${current} of ${total}: ${title}`}
        className="mt-2"
      >
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-full rounded-full bg-leaf transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
