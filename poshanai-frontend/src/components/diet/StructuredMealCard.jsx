import { ChefHat, Clock3, Utensils } from 'lucide-react';

function nutrient(value, unit) {
  return Number.isFinite(Number(value)) && value !== null && value !== undefined
    ? `${Number(value).toFixed(1)} ${unit}`
    : 'Unavailable';
}

function ingredientQuantity(item) {
  const weight = item.rawWeightGrams
    ?? item.rawQuantityGrams
    ?? item.rawIngredientWeight?.quantityGrams
    ?? item.quantityGrams
    ?? item.quantity;
  const unit = item.unit ?? item.rawIngredientWeight?.unit ?? 'g';
  return Number.isFinite(Number(weight)) && weight !== null && weight !== undefined
    ? `${Number(weight).toLocaleString()} ${unit}`
    : 'Quantity unavailable';
}

function instructionsFor(meal) {
  const steps = [meal.recipeInstructions, meal.cookingInstructions]
    .find((value) => (Array.isArray(value) && value.length) || (typeof value === 'string' && value.trim()));
  if (Array.isArray(steps)) return steps.filter((step) => typeof step === 'string' && step.trim());
  return typeof steps === 'string' && steps.trim() ? [steps.trim()] : [];
}

export default function StructuredMealCard({ meal, day }) {
  const name = meal.dishName ?? meal.mealName ?? meal.recipeId ?? 'Meal details unavailable';
  const category = meal.mealCategory ?? meal.mealType ?? 'Meal';
  const ingredients = Array.isArray(meal.ingredients) && meal.ingredients.length
    ? meal.ingredients
    : (Array.isArray(meal.items) ? meal.items : []);
  const instructions = instructionsFor(meal);
  const macros = meal.macros ?? {};
  const calories = meal.calories;
  const portion = meal.portionDescription
    ?? meal.cookedHouseholdMeasure
    ?? meal.cookedServingDescription
    ?? null;
  const ingredientState = (item) => {
    const state = item.state ?? item.weightBasis
      ?? (item.rawWeightGrams != null || item.rawIngredientWeight?.quantityGrams != null ? 'raw' : null);
    return state === 'raw' ? 'Raw ingredient weight' : state === 'cooked' ? 'Cooked weight' : null;
  };

  return (
    <article className="rounded-3xl border border-sage/80 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-forest dark:text-emerald-300">{day ? `Day ${day} · ` : ''}{meal.scheduleLabel ?? category}{meal.scheduleLabel && meal.scheduleLabel !== category ? ` (${category})` : ''}{meal.timing ? ` · ${meal.timing}` : ''}</p>
          <h3 className="mt-2 font-heading text-xl font-semibold text-slate-900 dark:text-white">{name}</h3>
          {portion && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{portion}</p>}
          {meal.primaryProteinSource && <p className="mt-2 inline-flex rounded-full bg-sage/55 px-2.5 py-1 text-xs font-semibold text-forest dark:bg-emerald-950 dark:text-emerald-200">Protein source: {meal.primaryProteinSource}</p>}
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage/55 text-forest dark:bg-emerald-950 dark:text-emerald-200"><Utensils size={18} aria-hidden="true" /></span>
      </header>

      <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Calories', nutrient(calories, 'kcal')],
          ['Protein', nutrient(macros.protein, 'g')],
          ['Carbohydrates', nutrient(macros.carbs, 'g')],
          ['Fat', nutrient(macros.fat, 'g')],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-paper px-3 py-2.5 dark:bg-slate-800/70">
            <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{value}</dd>
          </div>
        ))}
      </dl>
      {meal.nutritionStatus && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400" role="status">
          {meal.nutritionStatus === 'stored' ? 'Nutrition values saved with this plan.'
            : meal.nutritionStatus === 'recalculated' ? 'Nutrition values recalculated from verified saved ingredients.'
              : meal.nutritionStatus === 'incomplete' ? 'Some saved nutrition values are missing; no historical values were inferred.'
                : 'Nutrition values are unavailable; the saved ingredients do not support safe recalculation.'}
        </p>
      )}

      <details className="group mt-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm font-semibold text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-forest dark:text-emerald-200 [&::-webkit-details-marker]:hidden">
          Ingredients and portions <span aria-hidden="true" className="transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
          {ingredients.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {ingredients.map((item, itemIndex) => (
                <li key={`${item.ifctCode ?? item.canonicalName ?? item.foodName ?? itemIndex}-${itemIndex}`} className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{item.canonicalName ?? item.foodName ?? 'Ingredient name unavailable'}</span>
                  <span className="text-slate-600 dark:text-slate-400 sm:text-right">
                    {ingredientQuantity(item)}
                    {(item.householdMeasure || item.cookedServingDescription) && <span className="block text-xs">{item.householdMeasure ?? item.cookedServingDescription}</span>}
                    {ingredientState(item) && <span className="block text-xs">{ingredientState(item)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-600 dark:text-slate-300">Ingredient breakdown is unavailable for this saved plan.</p>}
        </div>
      </details>

      <details className="group mt-3 rounded-xl border border-slate-200 dark:border-slate-700">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm font-semibold text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-forest dark:text-emerald-200 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2"><ChefHat size={16} aria-hidden="true" /> Cooking instructions</span><span aria-hidden="true" className="transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
          {(meal.prepTime != null || meal.cookTime != null) && (
            <p className="mb-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400"><Clock3 size={14} aria-hidden="true" />{meal.prepTime != null ? `Prep ${meal.prepTime} min` : ''}{meal.prepTime != null && meal.cookTime != null ? ' · ' : ''}{meal.cookTime != null ? `Cook ${meal.cookTime} min` : ''}</p>
          )}
          {instructions.length ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700 marker:font-semibold marker:text-forest dark:text-slate-300 dark:marker:text-emerald-300">
              {instructions.map((step, stepIndex) => <li key={`${stepIndex}-${step}`}>{step}</li>)}
            </ol>
          ) : <p className="text-sm text-slate-600 dark:text-slate-300">Cooking instructions are unavailable for this saved plan.</p>}
        </div>
      </details>

      {meal.swapSuggestion && <p className="mt-3 rounded-xl bg-sage/45 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-800 dark:text-slate-300"><span className="font-semibold">Optional swap:</span> {meal.swapSuggestion}</p>}
    </article>
  );
}
