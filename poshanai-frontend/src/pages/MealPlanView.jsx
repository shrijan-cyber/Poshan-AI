import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getMealPlan, getMealPlanGroceryList, getMealPlanJobStatus } from '../api/mealPlanApi.js';
import UplinkLoader from '../components/ui/UplinkLoader.jsx';
import { classifyMealPlanJobStatus } from '../utils/mealPlanJobStatus.js';
import GroceryListPanel from '../components/diet/GroceryListPanel.jsx';
import StructuredMealCard from '../components/diet/StructuredMealCard.jsx';

const isJobId = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

function unwrap(value) {
  return value?.mealPlan ?? value?.plan ?? value?.data?.mealPlan ?? value?.data?.plan ?? value?.data ?? value;
}

function originalCarbFrom(description) {
  return String(description ?? '').split(/[,.;\n]/).map((part) => part.trim())
    .find((part) => /roti|chapati|phulka|rice|millet|bajra|jowar|ragi/i.test(part)) ?? '';
}

function formatTarget(value, unit) {
  return Number.isFinite(Number(value)) && value !== null && value !== undefined
    ? `${Number(value).toFixed(unit === 'kcal' ? 0 : 1)} ${unit}`
    : 'Unavailable';
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
        const outcome = classifyMealPlanJobStatus(data);
        if (outcome.kind === 'ready') {
          setStatus('loading-plan');
          await loadPlan(outcome.planId);
          return;
        }
        if (outcome.kind === 'error') {
          setError(outcome.message);
          setStatus('failed');
          return;
        }
        setStatus(outcome.status);
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
                <div className="mt-4 flex flex-wrap gap-4"><Link className="inline-block min-h-11 py-2 font-semibold underline" to="/dashboard">Return to dashboard</Link><Link className="inline-flex min-h-11 items-center rounded-xl bg-forest px-4 py-2 font-semibold text-white" to="/upload">Review another report</Link></div>
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
          <Link className="mt-5 inline-flex min-h-11 w-fit items-center rounded-xl bg-forest px-4 py-2.5 font-semibold text-white transition hover:bg-deepForest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2" to="/upload">Review another report</Link>
        </div>
      </header>
      {plan?.householdDiet && (
        <aside className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-950 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          <h2 className="font-semibold">Built around your household routine</h2>
          <p className="mt-1">Your usual day: {plan.householdDiet}</p>
          {originalCarb && <p className="mt-1">Staple noted in your routine: <span className="font-medium">{originalCarb}</span></p>}
        </aside>
      )}
      {plan?.targetCalories != null && (
        <section className="rounded-2xl border border-sage bg-white p-5 dark:border-slate-800 dark:bg-slate-900" aria-label="Daily nutrition targets">
          <h2 className="font-heading text-lg font-semibold text-slate-900 dark:text-white">Daily nutrition targets</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {formatTarget(plan.targetCalories, 'kcal')} target
            {plan.macroTargets && ` · Protein ${formatTarget(plan.macroTargets.protein, 'g')} · Carbohydrates ${formatTarget(plan.macroTargets.carbs, 'g')} · Fat ${formatTarget(plan.macroTargets.fat, 'g')}`}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Per-day actual totals are unavailable because this plan does not store a daily summary.
            {plan.nutritionAvailability?.meals === 'stored'
              ? ' Meal nutrition values below are saved backend values.'
              : plan.nutritionAvailability?.meals === 'incomplete'
                ? ' Some historical meal nutrition fields are missing and were not reconstructed.'
                : ' Historical meal nutrition is unavailable and cannot be safely recalculated from the stored data.'}
          </p>
        </section>
      )}
      <div className="grid gap-4 sm:grid-cols-2">{meals.map((meal, index) => <StructuredMealCard key={`${meal.recipeId ?? meal.dishName ?? meal.day}-${meal.mealType}-${index}`} meal={meal} day={meal.day} index={index} />)}</div>
      {!meals.length && <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-900">This plan has no meal details to display.</p>}
      <GroceryListPanel key={plan?._id ?? plan?.id ?? id} planId={plan?._id ?? plan?.id ?? (!isJobId(id) ? id : null)} fetchList={getMealPlanGroceryList} />
    </section>
  );
}
