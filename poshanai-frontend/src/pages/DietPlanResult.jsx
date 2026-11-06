import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Flame, Leaf, LoaderCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { getDietPlanGroceryList, getDietPlans } from '../api/dietPlanApi.js';
import { getApiError } from '../api/client.js';
import GroceryListPanel from '../components/diet/GroceryListPanel.jsx';
import StructuredMealCard from '../components/diet/StructuredMealCard.jsx';

export default function DietPlanResult() {
  const location = useLocation();
  const [plan, setPlan] = useState(location.state?.plan ?? null);
  const [isLoading, setIsLoading] = useState(!location.state?.plan);
  const [error, setError] = useState('');

  useEffect(() => {
    if (plan) return undefined;
    let cancelled = false;
    getDietPlans()
      .then((plans) => {
        if (!cancelled) setPlan(plans.find((item) => item.type === 'basic') ?? null);
      })
      .catch((requestError) => {
        if (!cancelled) setError(getApiError(requestError));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [plan]);

  const totalCalories = useMemo(() => {
    const daily = Array.isArray(plan?.dailyNutrition) ? plan.dailyNutrition[0] : plan?.dailyNutrition;
    const authoritativeCalories = daily?.calories ?? plan?.nutrition?.calories ?? plan?.calories;
    if (Number.isFinite(Number(authoritativeCalories)) && authoritativeCalories != null) return Number(authoritativeCalories);
    return null;
  }, [plan]);
  const targetCalories = Number.isFinite(Number(plan?.targetCalories)) && plan?.targetCalories != null
    ? Number(plan.targetCalories)
    : null;
  const progress = targetCalories > 0 && totalCalories != null ? Math.min(100, (totalCalories / targetCalories) * 100) : null;
  const caloriesStatus = totalCalories == null || targetCalories == null
    ? 'Target comparison unavailable'
    : totalCalories < targetCalories * 0.9 ? 'Below target range'
      : totalCalories > targetCalories * 1.1 ? 'Above target range' : 'Within target range';
  const nutritionStatus = plan?.nutritionAvailability?.status ?? 'unavailable';

  if (isLoading) return <div className="flex min-h-64 items-center justify-center text-emerald-800" role="status"><LoaderCircle className="animate-spin" /> <span className="ml-2">Loading your plan…</span></div>;
  if (error) return <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800" role="alert">{error} <Link to="/diet-plan" className="ml-2 underline">Try again</Link></div>;
  if (!plan) return (
    <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
      <Leaf className="mx-auto text-emerald-700" size={34} /><h1 className="mt-4 text-2xl font-bold text-slate-900">No diet plan yet</h1>
      <p className="mt-2 text-slate-600">Complete the short wizard to get your basic plan.</p><Link to="/diet-plan" className="mt-5 inline-flex rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white">Start the wizard</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/diet-plan" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950"><ArrowLeft size={16} /> Create another plan</Link>
      <div className="mt-5 flex flex-col justify-between gap-5 rounded-3xl bg-emerald-950 p-6 text-white sm:flex-row sm:items-end sm:p-9">
        <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">Your basic diet plan</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">A steady plan for your day</h1><p className="mt-2 text-emerald-100">Built around your goal and food preferences.</p></div>
        <Link to="/diet-plan" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-white px-4 py-3 font-semibold text-emerald-950 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950">Create another plan</Link>
      </div>

      <section className="mt-5 grid gap-4 md:grid-cols-[1.2fr_1fr]" aria-label="Daily nutrition overview">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-emerald-950/5">
          <div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Calories in this plan</p><p className="mt-1 text-3xl font-bold text-slate-900">{totalCalories == null ? 'Unavailable' : Math.round(totalCalories).toLocaleString()} <span className="text-base font-medium text-slate-500">{totalCalories == null ? '' : 'kcal'}</span></p></div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-orange-600"><Flame size={22} /></span></div>
          <div className="mt-5 flex items-center justify-between gap-3 text-sm"><span className="font-medium text-slate-700">Daily target</span><span className="text-right text-slate-500">{targetCalories == null ? 'Unavailable' : `${targetCalories.toLocaleString()} kcal`}</span></div>
          {progress == null ? <p className="mt-3 text-xs text-slate-500">Progress unavailable because the plan or target calories are missing.</p> : <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-emerald-100" role="progressbar" aria-label="Calories versus daily target" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)}><div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${progress}%` }} /></div>}
          <p className="mt-2 text-xs text-slate-600" role="status">
            {nutritionStatus === 'stored' ? `${caloriesStatus}. Nutrition values are the saved plan values.`
              : nutritionStatus === 'recalculated' ? `${caloriesStatus}. Nutrition values were recalculated from verified saved ingredients.`
                : nutritionStatus === 'incomplete' ? 'Some saved nutrition values are missing. Historical totals were not reconstructed.'
                  : 'Nutrition totals are unavailable for this saved plan and cannot be safely recalculated from its stored data.'}
          </p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-emerald-950/5">
          <p className="text-sm font-medium text-slate-500">Daily macros</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: 'Protein', value: plan.macros?.protein, color: 'bg-emerald-100 text-emerald-900' },
              { label: 'Carbs', value: plan.macros?.carbs, color: 'bg-amber-100 text-amber-900' },
              { label: 'Fat', value: plan.macros?.fat, color: 'bg-orange-100 text-orange-900' },
            ].map((macro) => <div key={macro.label} className={`rounded-2xl p-3 ${macro.color}`}><p className="text-xs font-medium opacity-75">{macro.label}</p><p className="mt-1 text-xl font-bold">{Number.isFinite(Number(macro.value)) && macro.value != null ? Number(macro.value).toFixed(1) : 'Unavailable'}{Number.isFinite(Number(macro.value)) && macro.value != null && <span className="ml-1 text-xs font-medium">g</span>}</p></div>)}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4"><p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">Your day</p><h2 className="mt-1 text-2xl font-bold text-slate-900">Meals and portions</h2></div>
        {plan.diversityWarnings?.map((warning) => <p key={warning} className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="status">{warning}</p>)}
        <div className="grid gap-4 md:grid-cols-2">{(plan.meals ?? []).map((meal, index) => <StructuredMealCard key={`${meal.recipeId ?? meal.dishName ?? meal.mealName}-${index}`} meal={meal} />)}</div>
        {!plan.meals?.length && <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">Meal details are unavailable for this saved plan.</p>}
      </section>
      <GroceryListPanel key={plan._id ?? plan.id} planId={plan._id ?? plan.id} fetchList={getDietPlanGroceryList} />
      {['incomplete', 'unachievable'].includes(plan.status) && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">This saved plan is marked {plan.status}. Review its available details before relying on it.</p>}
      {plan.disclaimer && <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">{plan.disclaimer}</p>}
    </div>
  );
}
