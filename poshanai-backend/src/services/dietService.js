import httpError from '../utils/httpError.js';
import { getHouseholdFoodName, getHouseholdFoodWhitelist, getIfctFoods } from '../rag/ifctLoader.js';
import { foodMatchesAnyRestriction } from './foodRestrictions.js';

let foods = [];
try {
  foods = getIfctFoods();
} catch {
  // Return a safe service-unavailable response when the packaged catalog is absent.
}

const activityFactors = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const mealNames = ['Breakfast', 'Lunch', 'Dinner', 'Snack 1', 'Snack 2', 'Snack 3', 'Snack 4', 'Snack 5', 'Snack 6', 'Snack 7'];
const macroKeys = ['protein', 'carbs', 'fat'];
const round1 = (value) => Math.round(value * 10) / 10;
const safeNutrient = (food, name) => Number.isFinite(food.nutrients?.[name]) ? food.nutrients[name] : 0;

function matchesDiet(food, dietType) {
  const tags = food.dietTags ?? [];
  if (dietType === 'veg') return tags.includes('veg');
  if (dietType === 'eggetarian') return tags.includes('eggetarian') || tags.includes('veg');
  if (dietType === 'vegan') {
    return tags.includes('veg')
      && !/milk and milk products|egg and egg products|poultry|animal meat|marine fish|marine shellfish|marine mollusks|fresh water fish/i.test(food.category);
  }
  return tags.some((tag) => ['nonveg', 'fishetarian', 'eggetarian', 'veg'].includes(tag));
}

function chooseFoods(profile) {
  if (!foods.length) throw httpError(503, 'FOOD_CATALOG_UNAVAILABLE', 'The food database is temporarily unavailable.');
  const requestText = [
    ...(Array.isArray(profile.preferredFoods) ? profile.preferredFoods : []),
    profile.typicalDiet ?? '',
  ].join(' ');
  const householdFoods = getHouseholdFoodWhitelist(foods, requestText);
  const restrictions = [...(profile.allergies ?? []), ...(profile.dislikes ?? [])].filter(Boolean);
  const eligible = householdFoods.filter((food) => Number(food.nutrients?.calories) > 0
    && macroKeys.every((key) => food.nutrients?.[key] !== null
      && food.nutrients?.[key] !== undefined
      && Number.isFinite(Number(food.nutrients[key])))
    && matchesDiet(food, profile.dietType)
    && !foodMatchesAnyRestriction(restrictions, {
      ...food,
      householdName: getHouseholdFoodName(food),
    }));

  const cerealCategory = /cereal|millet|grain/i;
  const groups = [
    eligible.filter((food) => cerealCategory.test(`${food.category} ${food.foodName}`)
      || /potato/i.test(getHouseholdFoodName(food))),
    eligible.filter((food) => /grain legumes|milk and milk products|egg and egg products|poultry|animal meat|marine fish|marine shellfish|marine mollusks|fresh water fish/i.test(food.category)),
    eligible.filter((food) => /green leafy vegetables|other vegetables|fruits|roots and tubers/i.test(food.category)),
  ];
  if (groups.some((group) => group.length === 0)) {
    // Narrow/novel dislikes should still produce a usable plan when the IFCT catalog has options.
    const fallback = eligible.filter((food) => !/oil|fat|ghee|sugar|jaggery|salt|spice/i.test(`${food.category} ${food.foodName}`));
    if (!fallback.length) throw httpError(422, 'NO_MATCHING_FOODS', 'No IFCT foods match the selected diet and dislikes.');
    return [fallback, fallback, fallback];
  }
  return groups;
}

function calculateTargetCalories(profile) {
  const genderOffset = profile.gender === 'male' ? 5 : profile.gender === 'female' ? -161 : -78;
  const bmr = (10 * profile.weightKg) + (6.25 * profile.heightCm) - (5 * profile.age) + genderOffset;
  const tdee = bmr * activityFactors[profile.activityLevel];
  // Moderate general-purpose adjustment; generated plans are educational, not medical advice.
  const multiplier = profile.goal === 'lose' ? 0.85 : profile.goal === 'gain' ? 1.1 : 1;
  return Math.round(tdee * multiplier);
}

function planPortion(food, calories) {
  const quantity = Math.min(2000, Math.max(1, round1((calories * 100) / food.nutrients.calories)));
  const factor = quantity / 100;
  return {
    quantity,
    calories: round1(safeNutrient(food, 'calories') * factor),
    macros: Object.fromEntries(macroKeys.map((key) => [key, round1(safeNutrient(food, key) * factor)])),
  };
}

/** Create a basic IFCT-based plan and calculate nutrition from actual selected portions. */
export function generateBasicDietPlan(profile) {
  const groups = chooseFoods(profile);
  const targetCalories = calculateTargetCalories(profile);
  const mealShares = profile.mealsPerDay === 1
    ? [1]
    : Array.from({ length: profile.mealsPerDay }, (_, index) => index === 0 ? 0.3 : 0.7 / (profile.mealsPerDay - 1));
  const portions = [0.65, 0.25, 0.1];
  const meals = mealShares.map((share, mealIndex) => {
    const mealTarget = targetCalories * share;
    const items = groups.map((group, groupIndex) => {
      const food = group[mealIndex % group.length];
      const portion = planPortion(food, mealTarget * portions[groupIndex]);
      return { foodName: food.foodName, ifctCode: food.ifctCode, quantity: portion.quantity, ...portion };
    });
    const totals = items.reduce((sum, item) => ({
      calories: sum.calories + item.calories,
      ...Object.fromEntries(macroKeys.map((key) => [key, sum[key] + item.macros[key]])),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    return {
      mealName: mealNames[mealIndex],
      cookedHouseholdMeasure: null,
      calories: round1(totals.calories),
      macros: Object.fromEntries(macroKeys.map((key) => [key, round1(totals[key])])),
      items: items.map(({ foodName, ifctCode, quantity }) => ({
        foodName,
        ifctCode,
        quantity,
        weightBasis: 'raw',
        householdMeasure: null,
        rawIngredientWeight: { quantityGrams: quantity, unit: 'g' },
      })),
    };
  });
  const macros = Object.fromEntries(macroKeys.map((key) => [
    key,
    round1(meals.reduce((sum, meal) => sum + meal.macros[key], 0)),
  ]));
  return {
    reportId: null,
    goal: profile.goal,
    targetCalories,
    macros,
    meals,
    type: 'basic',
    profile,
    disclaimer: 'This general nutrition plan is educational and is not medical advice. Consult a qualified healthcare professional for individual dietary needs.',
  };
}

export default { generateBasicDietPlan };
