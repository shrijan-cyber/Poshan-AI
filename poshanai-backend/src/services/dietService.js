import httpError from '../utils/httpError.js';
import {
  getHouseholdFoodName,
  getHouseholdFoodWhitelist,
  getIfctFoods,
  wasFoodExplicitlyRequested,
} from '../rag/ifctLoader.js';
import { foodMatchesAnyRestriction } from './foodRestrictions.js';
import recipeCatalog from './recipeCatalog.js';

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
const mealTypeForCategory = Object.freeze({ Breakfast: 'breakfast', Lunch: 'lunch', Dinner: 'dinner', Snack: 'snack' });
const nutrientKeys = ['calories', 'protein', 'carbs', 'fat', 'iron', 'calcium', 'vitaminD', 'vitaminB12', 'fiber'];
const MIN_RECIPE_PORTION_FACTOR = 0.5;
const MAX_RECIPE_PORTION_FACTOR = 3;
const MAX_RAW_MEAL_GRAMS = 1000;
const round1 = (value) => Math.round(value * 10) / 10;
const round2 = (value) => Math.round(value * 100) / 100;

function normalizedDietPreference(dietType) {
  const normalized = String(dietType ?? 'veg').toLowerCase().replace(/[-\s]/g, '');
  const labels = { veg: 'Veg', vegan: 'Vegan', eggetarian: 'Eggetarian', nonveg: 'Non-Veg' };
  const preference = labels[normalized];
  if (!preference) throw httpError(400, 'INVALID_DIET_TYPE', 'Choose Veg, Vegan, Eggetarian, or Non-Veg.');
  return preference;
}

function calculateTargetCalories(profile) {
  const required = ['age', 'weightKg', 'heightCm'];
  if (required.some((field) => !Number.isFinite(Number(profile[field])) || Number(profile[field]) <= 0)) {
    throw httpError(422, 'PROFILE_REQUIRED_FOR_RECIPE_PLAN', 'Age, height, and weight are required to calculate a meal-plan target.');
  }
  const genderOffset = profile.gender === 'male' ? 5 : profile.gender === 'female' ? -161 : -78;
  const bmr = (10 * profile.weightKg) + (6.25 * profile.heightCm) - (5 * profile.age) + genderOffset;
  const activityFactor = activityFactors[profile.activityLevel];
  if (!activityFactor) throw httpError(400, 'INVALID_ACTIVITY_LEVEL', 'Choose a supported activity level.');
  const tdee = bmr * activityFactor;
  const goalFactor = profile.goal === 'lose' ? 0.85 : profile.goal === 'gain' ? 1.1 : 1;
  return Math.round(tdee * goalFactor);
}

function calculateMacroTargets(profile, targetCalories) {
  const protein = round1(Number(profile.weightKg) * 0.8);
  const fat = round1((targetCalories * 0.25) / 9);
  const carbs = round1(Math.max(0, (targetCalories - (protein * 4) - (fat * 9)) / 4));
  return { protein, carbs, fat };
}

function hasDietCompatibleFood(food, dietPreference) {
  const category = String(food.category ?? '');
  if (dietPreference === 'Non-Veg') return true;
  if (dietPreference === 'Eggetarian') {
    return !/poultry|animal meat|marine fish|marine shellfish|marine mollusks|fresh water fish/i.test(category);
  }
  if (dietPreference === 'Vegan') {
    return food.dietTags?.includes('veg')
      && !/milk and milk products|egg and egg products|poultry|animal meat|marine fish|marine shellfish|marine mollusks|fresh water fish/i.test(category);
  }
  return food.dietTags?.includes('veg')
    && !/egg and egg products|poultry|animal meat|marine fish|marine shellfish|marine mollusks|fresh water fish/i.test(category);
}

function requestedRegion(region) {
  const normalized = String(region ?? '').toLowerCase();
  return ['north', 'south', 'east', 'west'].find((direction) => normalized.includes(direction)) ?? 'All';
}

function recipeAllowed(recipe, { dietPreference, restrictions, whitelistCodes, foodsByCode, region }) {
  if (!recipe.dietaryCompatibility.includes(dietPreference)) return false;
  if (region !== 'All' && recipe.region !== 'All' && recipe.region !== region) return false;
  return recipe.ingredients.every(({ ifctCode }) => {
    const food = foodsByCode.get(ifctCode);
    return food
      && whitelistCodes.has(ifctCode)
      && hasDietCompatibleFood(food, dietPreference)
      && !foodMatchesAnyRestriction(restrictions, { ...food, householdName: getHouseholdFoodName(food) });
  });
}

function mealCategories(mealsPerDay) {
  const count = Number(mealsPerDay);
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    throw httpError(400, 'INVALID_MEAL_FREQUENCY', 'Meal frequency must be from 1 to 10 meals per day.');
  }
  if (count === 1) return ['Lunch'];
  if (count === 2) return ['Breakfast', 'Dinner'];
  const categories = ['Breakfast', 'Lunch', 'Dinner'];
  while (categories.length < count) categories.splice(categories.length - 1, 0, 'Snack');
  return categories;
}

function chooseRecipe(category, candidates, day, mealIndex, preferenceText, usedRecipeIds) {
  const ranked = candidates
    .map((recipe) => ({
      recipe,
      preferenceScore: recipe.ingredients.reduce((score, ingredient) => {
        const food = foods.find((entry) => entry.ifctCode === ingredient.ifctCode);
        return score + Number(Boolean(food && wasFoodExplicitlyRequested(food, preferenceText)));
      }, 0),
      calorieCapacity: recipeCalorieCapacity(recipe),
    }))
    .sort((left, right) => right.calorieCapacity - left.calorieCapacity
      || right.preferenceScore - left.preferenceScore
      || left.recipe.recipeId.localeCompare(right.recipe.recipeId));
  if (!ranked.length) {
    throw httpError(422, 'NO_MATCHING_RECIPES', `No ${category.toLowerCase()} recipes match the selected diet, allergies, dislikes, and region.`);
  }
  const unused = ranked.filter(({ recipe }) => !usedRecipeIds.has(recipe.recipeId));
  const options = unused.length ? unused : ranked;
  const selected = options[0].recipe;
  usedRecipeIds.add(selected.recipeId);
  return selected;
}

function recipeCalorieCapacity(recipe) {
  const foodsByCode = new Map(foods.map((food) => [food.ifctCode, food]));
  const baseCalories = recipe.ingredients.reduce((total, ingredient) => (
    total + ((Number(foodsByCode.get(ingredient.ifctCode)?.nutrients?.calories) * ingredient.rawQuantityGrams) / 100)
  ), 0);
  const totalRawGrams = recipe.ingredients.reduce((sum, ingredient) => sum + ingredient.rawQuantityGrams, 0);
  const limits = [totalRawGrams > 0 ? MAX_RAW_MEAL_GRAMS / totalRawGrams : MAX_RECIPE_PORTION_FACTOR];
  for (const ingredient of recipe.ingredients) {
    const cap = rawPortionLimit(ingredient, foodsByCode.get(ingredient.ifctCode));
    if (cap) limits.push(cap / ingredient.rawQuantityGrams);
  }
  return baseCalories * Math.min(MAX_RECIPE_PORTION_FACTOR, ...limits);
}

function scaledValue(per100Grams, grams) {
  return per100Grams === null || per100Grams === undefined || !Number.isFinite(Number(per100Grams))
    ? null
    : round2((Number(per100Grams) * grams) / 100);
}

/** Calculate every IFCT nutrient from its raw edible ingredient weight. */
export function calculateIfctNutrition(food, rawWeightGrams) {
  if (!food || !Number.isFinite(Number(rawWeightGrams)) || Number(rawWeightGrams) < 0) {
    throw httpError(422, 'IFCT_NUTRITION_INPUT_INVALID', 'A validated IFCT food and non-negative raw weight are required.');
  }
  if (food.nutrients?.calories === 0 && Number(food.nutrients?.fat) > 0) {
    throw httpError(422, 'IFCT_ENERGY_UNRESOLVED', 'This IFCT food has unresolved energy data and cannot be used for nutrition calculations.');
  }
  return Object.fromEntries(nutrientKeys.map((key) => [key, scaledValue(food.nutrients?.[key], Number(rawWeightGrams))]));
}

export function validateMacroEnergyConsistency(nutrition, label = 'Meal') {
  const required = ['calories', 'protein', 'carbs', 'fat'];
  if (required.some((key) => nutrition?.[key] === null
    || nutrition?.[key] === undefined
    || !Number.isFinite(Number(nutrition[key])))) {
    throw httpError(422, 'NUTRITION_MACROS_UNAVAILABLE', `${label} is missing IFCT calories or macro data.`);
  }
  const macroCalories = (nutrition.protein * 4) + (nutrition.carbs * 4) + (nutrition.fat * 9);
  const calories = Number(nutrition.calories);
  const deviation = calories > 0 ? Math.abs(macroCalories - calories) / calories : Infinity;
  if (!Number.isFinite(deviation) || deviation > 0.1) {
    throw httpError(422, 'NUTRITION_MACRO_RECONCILIATION_FAILED', `${label} macro-derived energy differs from IFCT calories by more than 10%.`);
  }
  return { macroCalories: round2(macroCalories), deviation: round2(deviation), valid: true };
}

function sumNullable(entries, key) {
  if (entries.some((entry) => entry[key] === null || entry[key] === undefined)) return null;
  return round2(entries.reduce((sum, entry) => sum + Number(entry[key]), 0));
}

function scaleMeasure(measure, factor) {
  const match = String(measure ?? '').match(/^\s*(\d+(?:\/\d+)?|\d*\.\d+)\s+(.+)$/);
  if (!match) return measure ?? null;
  const [numerator, denominator] = match[1].split('/').map(Number);
  const quantity = round1((denominator ? numerator / denominator : numerator) * factor);
  return `${quantity} ${match[2]}`;
}

function rawPortionLimit(ingredient, food) {
  const name = String(food?.foodName ?? '').toLowerCase();
  if (ingredient.ifctCode === 'A015' || /^rice,/.test(name)) return 150;
  if (ingredient.ifctCode === 'A019' || /wheat flour, atta/.test(name)) return 150;
  if (food?.category === 'Grain Legumes') return 100;
  return null;
}

function cookedDescription(householdMeasure, cookedWeightGrams) {
  const cookedText = `${round1(cookedWeightGrams)} g cooked`;
  return householdMeasure ? `${householdMeasure} (${cookedText})` : cookedText;
}

function materializeMeal(recipe, factor, day, profile, foodsByCode) {
  const ingredientItems = recipe.ingredients.map((ingredient) => {
    const food = foodsByCode.get(ingredient.ifctCode);
    const grams = round1(ingredient.rawQuantityGrams * factor);
    const cookedWeightGrams = round1(grams * ingredient.yieldFactor);
    const nutrients = calculateIfctNutrition(food, grams);
    const householdMeasure = scaleMeasure(ingredient.householdMeasure, factor);
    const canonicalName = getHouseholdFoodName(food);
    return {
      ifctCode: food.ifctCode,
      canonicalName,
      foodName: canonicalName,
      quantity: grams,
      unit: 'g',
      rawQuantityGrams: grams,
      rawWeightGrams: grams,
      yieldFactor: ingredient.yieldFactor,
      cookedWeightGrams,
      cookedServingDescription: cookedDescription(householdMeasure, cookedWeightGrams),
      weightBasis: 'raw',
      state: 'raw',
      householdMeasure,
      rawIngredientWeight: { quantityGrams: grams, unit: 'g' },
      nutrients,
    };
  });
  const nutrition = Object.fromEntries(nutrientKeys.map((key) => [key, sumNullable(ingredientItems.map(({ nutrients }) => nutrients), key)]));
  validateMacroEnergyConsistency(nutrition, recipe.dishName);
  const mealType = mealTypeForCategory[recipe.mealCategory];
  return {
    day,
    recipeId: recipe.recipeId,
    dishName: recipe.dishName,
    mealName: recipe.dishName,
    mealCategory: recipe.mealCategory,
    mealType,
    region: recipe.region,
    dietaryCompatibility: recipe.dietaryCompatibility,
    servings: recipe.servings,
    portionDescription: `1 serving, adjusted ${round1(factor)}× from the household recipe` ,
    cookedHouseholdMeasure: null,
    cookedServingDescription: ingredientItems.map(({ canonicalName, cookedServingDescription }) => `${canonicalName}: ${cookedServingDescription}`).join('; '),
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    cookingInstructions: recipe.cookingInstructions,
    recipeInstructions: recipe.cookingInstructions,
    swapSuggestion: null,
    ingredients: ingredientItems.map(({ ifctCode, canonicalName, quantity, unit, rawQuantityGrams, rawWeightGrams, yieldFactor, cookedWeightGrams, cookedServingDescription, state, householdMeasure }) => ({
      ifctCode,
      canonicalName,
      quantity,
      unit,
      rawQuantityGrams,
      rawWeightGrams,
      yieldFactor,
      cookedWeightGrams,
      cookedServingDescription,
      householdMeasure,
      state,
    })),
    items: ingredientItems.map(({ ifctCode, foodName, quantity, weightBasis, householdMeasure, rawIngredientWeight, rawWeightGrams, yieldFactor, cookedWeightGrams, cookedServingDescription, nutrients }) => ({
      ifctCode,
      foodName,
      quantity,
      quantityGrams: quantity,
      weightBasis,
      householdMeasure,
      rawIngredientWeight,
      rawWeightGrams,
      yieldFactor,
      cookedWeightGrams,
      cookedServingDescription,
      nutrients,
    })),
    calories: nutrition.calories,
    macros: { protein: nutrition.protein, carbs: nutrition.carbs, fat: nutrition.fat },
    nutrition,
  };
}

function composeDay(day, categories, candidatesByCategory, targetCalories, profile, foodsByCode, previousMainCombination = null) {
  const usedRecipeIds = new Set();
  const preferenceText = [profile.typicalDiet, ...(profile.preferredFoods ?? [])].flat().filter(Boolean).join(' ');
  const recipes = categories.map((category, index) => chooseRecipe(
    category,
    candidatesByCategory.get(category) ?? [],
    day,
    index,
    preferenceText,
    usedRecipeIds,
  ));

  const lunchIndex = categories.indexOf('Lunch');
  const dinnerIndex = categories.indexOf('Dinner');
  const mainCombination = () => `${recipes[lunchIndex]?.recipeId ?? ''}|${recipes[dinnerIndex]?.recipeId ?? ''}`;
  if (previousMainCombination && mainCombination() === previousMainCombination) {
    for (const index of [lunchIndex, dinnerIndex].filter((value) => value >= 0)) {
      const category = categories[index];
      const alternatives = candidatesByCategory.get(category).filter((candidate) => (
        candidate.recipeId !== recipes[index].recipeId
        && !recipes.some((other, otherIndex) => otherIndex !== index && other.recipeId === candidate.recipeId)
      ));
      const replacement = alternatives.find((candidate) => {
        const prior = recipes[index];
        recipes[index] = candidate;
        const differs = mainCombination() !== previousMainCombination;
        recipes[index] = prior;
        return differs;
      });
      if (replacement) {
        recipes[index] = replacement;
        break;
      }
    }
    if (mainCombination() === previousMainCombination) {
      return { status: 'unachievable', message: `Day ${day} cannot meet the required lunch and dinner diversity with the selected restrictions.` };
    }
  }
  const baseCalories = recipes.reduce((total, recipe) => total + recipe.ingredients.reduce((mealTotal, ingredient) => {
    const food = foodsByCode.get(ingredient.ifctCode);
    return mealTotal + ((food.nutrients.calories * ingredient.rawQuantityGrams) / 100);
  }, 0), 0);
  if (!Number.isFinite(baseCalories) || baseCalories <= 0) {
    throw httpError(422, 'RECIPE_NUTRITION_UNAVAILABLE', 'The selected recipes do not have complete IFCT energy data.');
  }

  const portionLimits = recipes.map((recipe) => {
    const baseGrams = recipe.ingredients.reduce((sum, ingredient) => sum + ingredient.rawQuantityGrams, 0);
    const totalLimit = baseGrams > 0 ? MAX_RAW_MEAL_GRAMS / baseGrams : MAX_RECIPE_PORTION_FACTOR;
    const constrainedRawWeights = new Map();
    for (const ingredient of recipe.ingredients) {
      const food = foodsByCode.get(ingredient.ifctCode);
      const cap = rawPortionLimit(ingredient, food);
      if (!cap) continue;
      const key = `${cap}:${food.category === 'Grain Legumes' ? 'dal' : ingredient.ifctCode === 'A019' || /wheat flour, atta/i.test(food.foodName) ? 'atta' : 'rice'}`;
      constrainedRawWeights.set(key, (constrainedRawWeights.get(key) ?? 0) + ingredient.rawQuantityGrams);
    }
    const ingredientLimits = [...constrainedRawWeights.entries()].map(([key, grams]) => Number(key.split(':')[0]) / grams);
    return Math.min(totalLimit, ...ingredientLimits);
  });
  const requestedFactor = targetCalories / baseCalories;
  const maxSafeFactor = Math.min(MAX_RECIPE_PORTION_FACTOR, ...portionLimits);
  if (requestedFactor < MIN_RECIPE_PORTION_FACTOR || maxSafeFactor < MIN_RECIPE_PORTION_FACTOR) {
    return { status: 'unachievable', message: 'The calorie target is too low for realistic household recipe portions.' };
  }
  const factor = Math.min(requestedFactor, maxSafeFactor);
  if (!Number.isFinite(factor) || factor <= 0) {
    throw httpError(422, 'RECIPE_PORTION_UNAVAILABLE', 'The selected recipes cannot be portioned safely.');
  }
  const meals = recipes.map((recipe) => materializeMeal(recipe, factor, day, profile, foodsByCode));
  const actualCalories = meals.reduce((total, meal) => total + meal.calories, 0);
  const dailyNutrition = {
    calories: round2(actualCalories),
    protein: sumNullable(meals.map((meal) => meal.nutrition), 'protein'),
    carbs: sumNullable(meals.map((meal) => meal.nutrition), 'carbs'),
    fat: sumNullable(meals.map((meal) => meal.nutrition), 'fat'),
  };
  validateMacroEnergyConsistency(dailyNutrition, `Day ${day}`);
  if (actualCalories < targetCalories * 0.9 || actualCalories > targetCalories * 1.1) {
    return { status: 'unachievable', message: 'Available recipes cannot meet the calorie target within 10% without exceeding safe raw ingredient portions.' };
  }
  return { meals, mainCombination: mainCombination() };
}

/** Deterministically compose meals from validated household recipes and calculate all nutrients from IFCT. */
export function composeRecipeMealPlan(profile, { days = 1 } = {}) {
  if (!foods.length) throw httpError(503, 'FOOD_CATALOG_UNAVAILABLE', 'The food database is temporarily unavailable.');
  if (!Number.isInteger(days) || days < 1 || days > 30) throw httpError(400, 'INVALID_PLAN_DURATION', 'Plan duration must be from 1 to 30 days.');

  const dietPreference = normalizedDietPreference(profile.dietType);
  const targetCalories = calculateTargetCalories(profile);
  const macroTargets = calculateMacroTargets(profile, targetCalories);
  const categories = mealCategories(profile.mealsPerDay ?? 3);
  const requestText = [profile.typicalDiet, ...(profile.preferredFoods ?? [])].flat().filter(Boolean).join(' ');
  const householdFoods = getHouseholdFoodWhitelist(foods, requestText);
  const whitelistCodes = new Set(householdFoods.map(({ ifctCode }) => ifctCode));
  const foodsByCode = new Map(foods.map((food) => [food.ifctCode, food]));
  const restrictions = [...(profile.allergies ?? []), ...(profile.dislikes ?? [])].filter(Boolean);
  const region = requestedRegion(profile.region);
  const eligibleRecipes = recipeCatalog.filter((recipe) => recipeAllowed(recipe, {
    dietPreference,
    restrictions,
    whitelistCodes,
    foodsByCode,
    region,
  }));
  const candidatesByCategory = new Map(['Breakfast', 'Lunch', 'Dinner', 'Snack'].map((category) => [
    category,
    eligibleRecipes.filter((recipe) => recipe.mealCategory === category),
  ]));

  const meals = [];
  const dailyNutrition = [];
  let previousMainCombination = null;
  for (let day = 1; day <= days; day += 1) {
    const composedDay = composeDay(day, categories, candidatesByCategory, targetCalories, profile, foodsByCode, previousMainCombination);
    if (composedDay.status === 'unachievable') {
      return { status: 'unachievable', message: composedDay.message, targetCalories, macroTargets, meals: [] };
    }
    const dailyMeals = composedDay.meals;
    previousMainCombination = composedDay.mainCombination;
    meals.push(...dailyMeals);
    dailyNutrition.push({
      day,
      calories: round2(dailyMeals.reduce((sum, meal) => sum + meal.calories, 0)),
      protein: sumNullable(dailyMeals.map((meal) => meal.nutrition), 'protein'),
      carbs: sumNullable(dailyMeals.map((meal) => meal.nutrition), 'carbs'),
      fat: sumNullable(dailyMeals.map((meal) => meal.nutrition), 'fat'),
    });
  }
  const average = (key) => round2(dailyNutrition.reduce((sum, day) => sum + (day[key] ?? 0), 0) / days);
  return {
    reportId: null,
    goal: profile.goal ?? 'maintain',
    targetCalories,
    macroTargets,
    macros: { protein: average('protein'), carbs: average('carbs'), fat: average('fat') },
    dailyNutrition,
    meals,
    type: 'basic',
    profile: { ...profile, dietType: dietPreference.toLowerCase().replace('-', '') },
    disclaimer: 'This general nutrition plan is educational and is not medical advice. Consult a qualified healthcare professional for individual dietary needs.',
  };
}

export function generateBasicDietPlan(profile) {
  return composeRecipeMealPlan(profile);
}

export { calculateTargetCalories, calculateMacroTargets };
export default { generateBasicDietPlan, composeRecipeMealPlan, calculateTargetCalories, calculateMacroTargets };
