const macroKeys = ['protein', 'carbs', 'fat'];

function nutrientState(values = {}) {
  const keys = ['calories', ...macroKeys];
  const available = keys.filter((key) => values[key] !== null
    && values[key] !== undefined
    && Number.isFinite(Number(values[key])));

  if (available.length === keys.length) return 'stored';
  return available.length ? 'incomplete' : 'unavailable';
}

function valueHasNutrition(meal) {
  return nutrientState({ calories: meal?.calories, ...(meal?.macros ?? {}) });
}

function summarizeStates(states) {
  if (!states.length || states.every((state) => state === 'unavailable')) return 'unavailable';
  if (states.every((state) => state === 'stored')) return 'stored';
  return 'incomplete';
}

const noSafeRecalculationReason = 'Historical nutrition cannot be safely recalculated: the current IFCT manifest does not verify source-column mapping or record-level provenance. Saved plan data was left unchanged.';

/**
 * Annotate saved plan data without changing it or deriving new nutrient values.
 * Nutrition statuses describe persisted values only. Recalculation is withheld
 * until the IFCT source mapping and record provenance are verified.
 */
export function addDietPlanNutritionAvailability(plan) {
  const meals = Array.isArray(plan?.meals) ? plan.meals : [];
  const daily = Array.isArray(plan?.dailyNutrition) ? plan.dailyNutrition : [];
  const dailyStates = daily.map((entry) => nutrientState(entry));
  const mealStates = meals.map(valueHasNutrition);
  const hasDaily = daily.length > 0;
  const expectedDayCount = new Set(meals.map((meal) => meal.day).filter(Number.isInteger)).size;
  const dailyStatus = !hasDaily ? 'unavailable'
    : expectedDayCount > daily.length && dailyStates.every((state) => state === 'stored')
      ? 'incomplete'
      : summarizeStates(dailyStates);
  const mealsStatus = summarizeStates(mealStates);
  const status = hasDaily ? dailyStatus : (mealsStatus === 'stored' ? 'incomplete' : mealsStatus);

  return {
    ...plan,
    meals: meals.map((meal, index) => ({ ...meal, nutritionStatus: mealStates[index] })),
    nutritionAvailability: {
      status,
      daily: dailyStatus,
      meals: mealsStatus,
      recalculation: status === 'stored'
        ? { status: 'not_needed' }
        : { status: 'unavailable', reason: noSafeRecalculationReason },
    },
  };
}

export function addMealPlanNutritionAvailability(plan) {
  const meals = Array.isArray(plan?.meals) ? plan.meals : [];
  const mealStates = meals.map(valueHasNutrition);
  const status = summarizeStates(mealStates);

  return {
    ...plan,
    meals: meals.map((meal, index) => ({ ...meal, nutritionStatus: mealStates[index] })),
    nutritionAvailability: {
      status,
      daily: 'unavailable',
      meals: status,
      recalculation: status === 'stored'
        ? { status: 'not_needed' }
        : { status: 'unavailable', reason: noSafeRecalculationReason },
    },
  };
}

export { nutrientState };
