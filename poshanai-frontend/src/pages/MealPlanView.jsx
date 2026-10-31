import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getMealPlan, getMealPlanJobStatus } from '../api/mealPlanApi.js';
import UplinkLoader from '../components/ui/UplinkLoader.jsx';

const isJobId = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

function unwrap(value) {
  return value?.mealPlan ?? value?.plan ?? value?.data?.mealPlan ?? value?.data?.plan ?? value?.data ?? value;
}

function formatNutrient(value, unit) {
  return Number.isFinite(Number(value)) && value !== null && value !== undefined
    ? `${Number(value).toFixed(1)} ${unit}`
    : 'Data unavailable';
}

function originalCarbFrom(description) {
  return String(description ?? '').split(/[,.;\n]/).map((part) => part.trim())
    .find((part) => /roti|chapati|phulka|rice|millet|bajra|jowar|ragi/i.test(part)) ?? '';
}

export default function MealPlanView() {
  const { id } = useParams();
  const [plan, setPlan] = useState(null);
  const [status, setStatus] = useState(!id ? 'empty' : isJobId(id) ? 'queued' : 'loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let timer;
    if (!id) {
      return () => { active = false; };
    }
    async function loadPlan(planId) {
      const response = await getMealPlan(planId);
      if (active) {
        setPlan(unwrap(response));
        setStatus('completed');
      }
    }
    async function poll() {
      try {
        if (!isJobId(id)) {
          await loadPlan(id);
          return;
        }
        const data = unwrap(await getMealPlanJobStatus(id));
        if (!active) return;
        if (data.status === 'completed' && data.planId) {
          setStatus('loading-plan');
          await loadPlan(data.planId);
          return;
        }
        if (data.status === 'failed') {
          setError(data.message || 'Meal-plan generation failed. Please try again.');
          setStatus('failed');
          return;
        }
        setStatus(data.status || 'processing');
        timer = window.setTimeout(poll, 2000);
      } catch (requestError) {
        if (!active) return;
        setError(requestError.message || 'Could not check meal-plan progress.');
        setStatus('failed');
      }
    }
    poll();
    return () => { active = false; window.clearTimeout(timer); };
  }, [id]);

  const viewStatus = id ? status : 'empty';

  if (viewStatus !== 'completed') {
    return (
      <section className="mx-auto max-w-5xl font-sans">
        <header className="rounded-2xl border border-sage bg-gradient-to-br from-white to-sage/50 p-6 shadow-sm sm:p-10 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
          <div className="flex min-h-[260px] flex-col justify-center">
            <p className="text-sm font-semibold text-forest dark:text-emerald-300">PoshanAI · your nutrition guide</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              {viewStatus === 'failed' ? 'Plan unavailable' : viewStatus === 'empty' ? 'Your meal plan' : 'Preparing your meal plan'}
            </h1>
            {viewStatus === 'failed' ? (
              <div role="alert" className="mt-3 max-w-2xl text-red-700 dark:text-red-300">
                <p>{error}</p>
                <Link className="mt-4 inline-block font-semibold underline" to="/dashboard">Return to dashboard</Link>
              </div>
            ) : viewStatus === 'empty' ? (
              <div className="mt-3 max-w-2xl">
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Meal suggestions are educational and do not replace advice from a qualified healthcare professional.</p>
                <Link className="mt-5 inline-flex rounded-xl bg-forest px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-deepForest" to="/diet-plan">Create a basic diet plan</Link>
              </div>
            ) : (
              <UplinkLoader className="mt-5" label={viewStatus === 'loading-plan' ? 'Opening your meal plan…' : 'Generating your personalized meal plan…'} />
            )}
          </div>
        </header>
      </section>
    );
  }

  const meals = Array.isArray(plan?.meals) ? plan.meals : [];
  const originalCarb = originalCarbFrom(plan?.householdDiet);
  return (
    <section className="mx-auto max-w-5xl space-y-6 font-sans">
      <header className="rounded-2xl border border-sage bg-gradient-to-br from-white to-sage/50 p-6 shadow-sm sm:p-10 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
        <div className="flex min-h-[210px] flex-col justify-center">
          <p className="text-sm font-semibold text-forest dark:text-emerald-300">Personalized nutrition</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">{plan?.title || 'Your meal plan'}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{plan?.disclaimer || 'Nutrition suggestions are for awareness and do not replace advice from a qualified healthcare professional.'}</p>
        </div>
      </header>
      {plan?.householdDiet && (
        <aside className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-950 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          <h2 className="font-semibold">Built around your household routine</h2>
          <p className="mt-1">Your usual day: {plan.householdDiet}</p>
        </aside>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {meals.map((meal, index) => (
          <article key={`${meal.day}-${meal.mealType}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-forest dark:text-emerald-300">Day {meal.day} · {meal.mealType}</p>
            {originalCarb && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Your original carb: <span className="font-medium text-slate-900 dark:text-white">{originalCarb}</span></p>}
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Protein addition: <span className="font-semibold text-leaf dark:text-emerald-300">{meal.proteinSource || 'Data unavailable'}</span>{meal.items?.find((item) => item.foodName === meal.proteinSource)?.quantityGrams ? ` · ${meal.items.find((item) => item.foodName === meal.proteinSource).quantityGrams} g` : ''}</p>
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">{meal.items?.map((item) => <li key={`${item.ifctCode}-${item.foodName}`} className="py-3 text-sm text-slate-700 dark:text-slate-200"><div className="flex justify-between gap-3"><span>{item.foodName}</span><span className="shrink-0 text-slate-500">{item.quantityGrams} g</span></div><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Protein {formatNutrient(item.nutrients?.protein, 'g')} · Carbs {formatNutrient(item.nutrients?.carbs, 'g')}</p></li>)}</ul>
            <div className="mt-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Cooking instructions</h3>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{meal.cookingInstructions || 'Instructions unavailable for this older plan.'}</p>
            </div>
          </article>
        ))}
      </div>
      {!meals.length && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">This plan has no meal details to display.</p>}
    </section>
  );
}
