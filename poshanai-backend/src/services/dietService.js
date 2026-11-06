import httpError from '../utils/httpError.js';
import {
  getHouseholdFoodName,
  getHouseholdFoodWhitelist,
  getIfctFoods,
  wasFoodExplicitlyRequested,
} from '../rag/ifctLoader.js';
import { foodMatchesAnyRestriction } from './foodRestrictions.js';
import recipeCatalog from './recipeCatalog.js';
import { auditRecipeProvenance } from './recipeQualityAudit.js';

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
  const age = Number(profile.age);
  const weightKg = Number(profile.weightKg);
  const heightCm = Number(profile.heightCm);
  if (age < 13 || age > 100 || weightKg < 20 || weightKg > 200 || heightCm < 100 || heightCm > 250) {
    throw httpError(422, 'PROFILE_OUT_OF_RANGE', 'Age, height, and weight must be within the supported profile ranges.');
  }
  const gender = String(profile.gender ?? '').toLowerCase();
  if (!['male', 'female', 'other'].includes(gender)) {
    throw httpError(400, 'INVALID_GENDER', 'Choose a supported gender value.');
  }
  const genderOffset = gender === 'male' ? 5 : gender === 'female' ? -161 : -78;
  const bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + genderOffset;
  const activityLevel = String(profile.activityLevel ?? '').toLowerCase().replace(/[ -]/g, '_');
  const activityFactor = activityFactors[activityLevel];
  if (!activityFactor) throw httpError(400, 'INVALID_ACTIVITY_LEVEL', 'Choose a supported activity level.');
  const tdee = bmr * activityFactor;
  const goal = String(profile.goal ?? 'maintain').toLowerCase();
  if (!['lose', 'maintain', 'gain'].includes(goal)) {
    throw httpError(400, 'INVALID_GOAL', 'Choose lose, maintain, or gain as the plan goal.');
  }
  const goalFactor = goal === 'lose' ? 0.85 : goal === 'gain' ? 1.1 : 1;
  const targetCalories = Math.round(tdee * goalFactor);
  if (!Number.isFinite(targetCalories) || targetCalories <= 0) {
    throw httpError(422, 'INVALID_NUTRITION_TARGET', 'A valid positive calorie target could not be calculated from this profile.');
  }
  return targetCalories;
}

function calculateMacroTargets(profile, targetCalories) {
  if (!Number.isFinite(Number(targetCalories)) || Number(targetCalories) <= 0
    || !Number.isFinite(Number(profile.weightKg)) || Number(profile.weightKg) <= 0) {
    throw httpError(422, 'INVALID_NUTRITION_TARGET', 'Positive calorie and weight values are required to calculate macro targets.');
  }
  const protein = round1(Number(profile.weightKg) * 0.8);
  const fat = round1((targetCalories * 0.25) / 9);
  const carbs = round1(Math.max(0, (targetCalories - (protein * 4) - (fat * 9)) / 4));
  const targets = { protein, carbs, fat };
  if (Object.values(targets).some((value) => !Number.isFinite(value) || value < 0)) {
    throw httpError(422, 'INVALID_NUTRITION_TARGET', 'The profile produced invalid macronutrient targets.');
  }
  const targetEnergy = (protein * 4) + (carbs * 4) + (fat * 9);
  if (Math.abs(targetEnergy - Number(targetCalories)) / Number(targetCalories) > 0.01) {
    throw httpError(422, 'INVALID_NUTRITION_TARGET', 'Macronutrient targets do not reconcile with the calorie target.');
  }
  return targets;
}

function restrictionList(value, label) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw httpError(400, 'INVALID_FOOD_RESTRICTIONS', `${label} must be an array of non-empty food names.`);
  }
  return [...new Set(value.map((item) => item.trim()))];
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

function recipeAllowed(recipe, { dietPreference, allergies, dislikes, whitelistCodes, foodsByCode, region }) {
  if (!recipe.dietaryCompatibility.includes(dietPreference)) return false;
  if (region !== 'All' && recipe.region !== 'All' && recipe.region !== region) return false;
  return recipe.ingredients.every(({ ifctCode }) => {
    const food = foodsByCode.get(ifctCode);
    return food
      && whitelistCodes.has(ifctCode)
      && hasDietCompatibleFood(food, dietPreference)
      && !foodMatchesAnyRestriction(allergies, { ...food, householdName: getHouseholdFoodName(food) })
      && !foodMatchesAnyRestriction(dislikes, { ...food, householdName: getHouseholdFoodName(food) });
  });
}

const defaultSchedule = Object.freeze({
  1: [{ name: 'Meal', category: 'Lunch', time: null }],
  2: [{ name: 'Brunch', category: 'Lunch', time: '10:30' }, { name: 'Dinner', category: 'Dinner', time: '19:30' }],
  3: [{ name: 'Breakfast', category: 'Breakfast', time: '08:00' }, { name: 'Lunch', category: 'Lunch', time: '13:00' }, { name: 'Dinner', category: 'Dinner', time: '19:30' }],
  4: [{ name: 'Breakfast', category: 'Breakfast', time: '08:00' }, { name: 'Lunch', category: 'Lunch', time: '13:00' }, { name: 'Evening snack', category: 'Snack', time: '17:00' }, { name: 'Dinner', category: 'Dinner', time: '19:30' }],
  5: [{ name: 'Breakfast', category: 'Breakfast', time: '08:00' }, { name: 'Mid-morning snack', category: 'Snack', time: '10:30' }, { name: 'Lunch', category: 'Lunch', time: '13:00' }, { name: 'Evening snack', category: 'Snack', time: '17:00' }, { name: 'Dinner', category: 'Dinner', time: '19:30' }],
  6: [{ name: 'Breakfast', category: 'Breakfast', time: '07:30' }, { name: 'Mid-morning snack', category: 'Snack', time: '10:00' }, { name: 'Lunch', category: 'Lunch', time: '12:30' }, { name: 'Afternoon snack', category: 'Snack', time: '15:30' }, { name: 'Dinner', category: 'Dinner', time: '19:00' }, { name: 'Evening snack', category: 'Snack', time: '21:00' }],
});

function mealScheduleFor(profile) {
  const count = Number(profile.mealsPerDay ?? 3);
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    throw httpError(400, 'INVALID_MEAL_FREQUENCY', 'Meal frequency must be from 1 to 10 meals per day.');
  }
  if (Array.isArray(profile.mealSchedule) && profile.mealSchedule.length) {
    if (profile.mealSchedule.length !== count) {
      throw httpError(400, 'INVALID_MEAL_SCHEDULE', 'Custom meal schedule length must match mealsPerDay.');
    }
    return profile.mealSchedule.map(({ name, category, time }) => ({ name, category, time: time ?? null }));
  }
  if (defaultSchedule[count]) return defaultSchedule[count].map((slot) => ({ ...slot }));
  const categories = ['Breakfast', 'Lunch', 'Dinner'];
  while (categories.length < count) categories.splice(categories.length - 1, 0, 'Snack');
  return categories.map((category, index) => ({ name: category === 'Snack' ? `Snack ${index}` : category, category, time: null }));
}

function proteinSourceForRecipe(recipe, foodsByCode) {
  const contributions = new Map();
  let totalProtein = 0;
  for (const ingredient of recipe.ingredients) {
    const food = foodsByCode.get(ingredient.ifctCode);
    const protein = Number(food?.nutrients?.protein);
    if (!Number.isFinite(protein) || protein <= 0) continue;
    const contribution = (protein * ingredient.rawQuantityGrams) / 100;
    totalProtein += contribution;
    const category = String(food.category ?? '').toLowerCase();
    const name = String(food.foodName ?? '').toLowerCase();
    let group = null;
    if (category === 'milk and milk products') group = 'dairy';
    else if (category === 'egg and egg products') group = 'eggs';
    else if (/poultry|animal meat/.test(category)) group = 'poultry';
    else if (/marine fish|marine shellfish|marine mollusks|fresh water fish/.test(category)) group = 'seafood';
    else if (/soya|soy/.test(name)) group = 'soy';
    else if (category === 'grain legumes') group = /rajmah|chana|gram, whole|lobia|cowpea/.test(name) ? 'beans' : 'legumes';
    else if (category === 'nuts and oil seeds') group = 'nuts-seeds';
    if (!group) continue;
    const current = contributions.get(group) ?? { grams: 0, protein: 0, label: getHouseholdFoodName(food) };
    current.protein += contribution;
    current.grams += ingredient.rawQuantityGrams;
    if (contribution > current.protein - contribution) current.label = getHouseholdFoodName(food);
    contributions.set(group, current);
  }
  const primary = [...contributions.entries()]
    .filter(([, source]) => source.protein >= 3 && totalProtein > 0 && source.protein / totalProtein >= 0.3)
    .sort((left, right) => right[1].protein - left[1].protein || left[0].localeCompare(right[0]))[0];
  return primary ? { group: primary[0], label: primary[1].label, proteinGrams: round2(primary[1].protein) } : null;
}

export function getPrimaryProteinSource(recipe, foodRecords = foods) {
  return proteinSourceForRecipe(recipe, new Map(foodRecords.map((food) => [food.ifctCode, food])));
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

function recipeSetMetrics(recipes, targetCalories, targetProtein, foodsByCode) {
  let baseCalories = 0;
  let baseProtein = 0;
  let maximumFactor = MAX_RECIPE_PORTION_FACTOR;
  for (const recipe of recipes) {
    let mealCalories = 0;
    let mealProtein = 0;
    let totalRawGrams = 0;
    const constrainedWeights = new Map();
    for (const ingredient of recipe.ingredients) {
      const food = foodsByCode.get(ingredient.ifctCode);
      mealCalories += (Number(food.nutrients.calories) * ingredient.rawQuantityGrams) / 100;
      mealProtein += (Number(food.nutrients.protein) * ingredient.rawQuantityGrams) / 100;
      totalRawGrams += ingredient.rawQuantityGrams;
      const cap = rawPortionLimit(ingredient, food);
      if (!cap) continue;
      const group = food.category === 'Grain Legumes' ? 'dal'
        : ingredient.ifctCode === 'A019' || /wheat flour, atta/i.test(food.foodName) ? 'atta' : 'rice';
      const key = `${cap}:${group}`;
      constrainedWeights.set(key, (constrainedWeights.get(key) ?? 0) + ingredient.rawQuantityGrams);
    }
    let mealLimit = Math.min(MAX_RECIPE_PORTION_FACTOR, totalRawGrams > 0 ? MAX_RAW_MEAL_GRAMS / totalRawGrams : MAX_RECIPE_PORTION_FACTOR);
    for (const [key, grams] of constrainedWeights) mealLimit = Math.min(mealLimit, Number(key.split(':')[0]) / grams);
    maximumFactor = Math.min(maximumFactor, mealLimit);
    baseCalories += mealCalories;
    baseProtein += mealProtein;
  }
  const requestedFactor = baseCalories > 0 ? targetCalories / baseCalories : Infinity;
  const factor = Math.min(requestedFactor, maximumFactor);
  const calories = baseCalories * factor;
  const protein = baseProtein * factor;
  const calorieDeviation = targetCalories > 0 ? Math.abs(calories - targetCalories) / targetCalories : Infinity;
  const proteinDeviation = targetProtein > 0 ? Math.abs(protein - targetProtein) / targetProtein : 0;
  return { baseCalories, baseProtein, maximumFactor, factor, calories, protein, calorieDeviation, proteinDeviation };
}

function selectDailyRecipes(categories, candidatesByCategory, targetCalories, macroTargets, preferenceText, foodsByCode) {
  const maxBeamSize = 256;
  let beam = [{ recipes: [], groups: [], preferenceScore: 0, capacity: 0, baseCalories: 0, baseProtein: 0 }];
  for (const category of categories) {
    const categoryCandidates = candidatesByCategory.get(category) ?? [];
    const expanded = [];
    for (const state of beam) {
      const unused = categoryCandidates.filter(({ recipeId }) => !state.recipes.some((recipe) => recipe.recipeId === recipeId));
      for (const recipe of unused) {
        const source = proteinSourceForRecipe(recipe, foodsByCode);
        const preferenceScore = recipe.ingredients.reduce((score, ingredient) => {
          const food = foodsByCode.get(ingredient.ifctCode);
          return score + Number(Boolean(food && wasFoodExplicitlyRequested(food, preferenceText)));
        }, 0);
        const baseCalories = recipe.ingredients.reduce((sum, ingredient) => (
          sum + (Number(foodsByCode.get(ingredient.ifctCode).nutrients.calories) * ingredient.rawQuantityGrams) / 100
        ), 0);
        const baseProtein = recipe.ingredients.reduce((sum, ingredient) => (
          sum + (Number(foodsByCode.get(ingredient.ifctCode).nutrients.protein) * ingredient.rawQuantityGrams) / 100
        ), 0);
        const combinedCalories = state.baseCalories + baseCalories;
        const combinedProtein = state.baseProtein + baseProtein;
        const proteinFit = combinedCalories > 0 && macroTargets.protein > 0
          ? Math.abs((targetCalories * combinedProtein / combinedCalories) - macroTargets.protein) / macroTargets.protein
          : 0;
        expanded.push({
          recipes: [...state.recipes, recipe],
          groups: source ? [...state.groups, source.group] : state.groups,
          preferenceScore: state.preferenceScore + preferenceScore,
          capacity: state.capacity + recipeCalorieCapacity(recipe),
          baseCalories: combinedCalories,
          baseProtein: combinedProtein,
          proteinFit,
        });
      }
    }
    expanded.sort((left, right) => {
      const leftRepeatedSources = left.groups.length - new Set(left.groups).size;
      const rightRepeatedSources = right.groups.length - new Set(right.groups).size;
      const leftRepeatedRecipes = left.recipes.length - new Set(left.recipes.map(({ recipeId }) => recipeId)).size;
      const rightRepeatedRecipes = right.recipes.length - new Set(right.recipes.map(({ recipeId }) => recipeId)).size;
      return leftRepeatedSources - rightRepeatedSources
        || leftRepeatedRecipes - rightRepeatedRecipes
        || right.preferenceScore - left.preferenceScore
        || left.proteinFit - right.proteinFit
        || Math.abs(left.capacity - targetCalories) - Math.abs(right.capacity - targetCalories)
        || right.preferenceScore - left.preferenceScore
        || left.recipes.map(({ recipeId }) => recipeId).join('|').localeCompare(right.recipes.map(({ recipeId }) => recipeId).join('|'));
    });
    beam = expanded.slice(0, maxBeamSize);
    if (!beam.length) return [];
  }

  const targetProtein = macroTargets.protein;
  return beam.map((state) => {
    const metrics = recipeSetMetrics(state.recipes, targetCalories, targetProtein, foodsByCode);
    const repeats = state.groups.length - new Set(state.groups).size;
    const duplicateRecipes = state.recipes.length - new Set(state.recipes.map(({ recipeId }) => recipeId)).size;
    const outsideTolerance = metrics.calorieDeviation > 0.1 || metrics.factor < MIN_RECIPE_PORTION_FACTOR;
    const score = (outsideTolerance ? 1000 + metrics.calorieDeviation * 10 : metrics.calorieDeviation * 5)
      + metrics.proteinDeviation * 0.6
      + repeats * 0.25
      + duplicateRecipes * 0.1
      - state.preferenceScore * 0.5;
    return { ...state, metrics, score };
  }).sort((left, right) => left.score - right.score
    || left.recipes.map(({ recipeId }) => recipeId).join('|').localeCompare(right.recipes.map(({ recipeId }) => recipeId).join('|')))[0]?.recipes ?? [];
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
  const primaryProteinSource = proteinSourceForRecipe(recipe, foodsByCode);
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
    primaryProteinSource: primaryProteinSource?.label ?? null,
    primaryProteinSourceGroup: primaryProteinSource?.group ?? null,
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

function composeDay(day, categories, candidatesByCategory, targetCalories, macroTargets, profile, foodsByCode, previousMainCombination = null) {
  const preferenceText = [profile.typicalDiet, ...(profile.preferredFoods ?? [])].flat().filter(Boolean).join(' ');
  const recipes = selectDailyRecipes(categories, candidatesByCategory, targetCalories, macroTargets, preferenceText, foodsByCode);
  if (recipes.length !== categories.length || recipes.some((recipe) => !recipe)) {
    return {
      status: 'unachievable',
      message: 'No safe recipe set covers every requested meal category with the selected diet, allergies, dislikes, and region.',
    };
  }

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
  const recipeSet = recipeSetMetrics(recipes, targetCalories, macroTargets.protein, foodsByCode);
  const baseCalories = recipeSet.baseCalories;
  if (!Number.isFinite(baseCalories) || baseCalories <= 0) {
    throw httpError(422, 'RECIPE_NUTRITION_UNAVAILABLE', 'The selected recipes do not have complete IFCT energy data.');
  }

  const requestedFactor = targetCalories / baseCalories;
  const maxSafeFactor = recipeSet.maximumFactor;
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
  const sourceGroups = meals.map((meal) => meal.primaryProteinSourceGroup).filter(Boolean);
  const diversityWarning = new Set(sourceGroups).size < sourceGroups.length
    ? 'This plan repeats a primary protein source because the currently eligible recipes and portion limits did not produce a fully distinct combination.'
    : null;
  return { meals, mainCombination: mainCombination(), diversityWarning };
}

/** Deterministically compose meals from validated household recipes and calculate all nutrients from IFCT. */
export function composeRecipeMealPlan(profile, { days = 1 } = {}) {
  if (!foods.length) throw httpError(503, 'FOOD_CATALOG_UNAVAILABLE', 'The food database is temporarily unavailable.');
  if (!Number.isInteger(days) || days < 1 || days > 30) throw httpError(400, 'INVALID_PLAN_DURATION', 'Plan duration must be from 1 to 30 days.');

  const dietPreference = normalizedDietPreference(profile.dietType);
  const targetCalories = calculateTargetCalories(profile);
  const macroTargets = calculateMacroTargets(profile, targetCalories);
  if (targetCalories < 1200) {
    return { status: 'unachievable', message: 'The calorie target is too low for a safe, practical household meal plan.', targetCalories, macroTargets, meals: [] };
  }
  const schedule = mealScheduleFor(profile);
  const categories = schedule.map(({ category }) => category);
  const requestText = [profile.typicalDiet, ...(profile.preferredFoods ?? [])].flat().filter(Boolean).join(' ');
  const householdFoods = getHouseholdFoodWhitelist(foods, requestText);
  const whitelistCodes = new Set(householdFoods.map(({ ifctCode }) => ifctCode));
  const foodsByCode = new Map(foods.map((food) => [food.ifctCode, food]));
  const recipeAudits = new Map(recipeCatalog.map((recipe) => [
    recipe.recipeId,
    auditRecipeProvenance(recipe, foods),
  ]));
  const allergies = restrictionList(profile.allergies, 'Allergies');
  const dislikes = restrictionList(profile.dislikes, 'Dislikes');
  const region = requestedRegion(profile.region);
  const eligibleRecipes = recipeCatalog.filter((recipe) => (
    recipeAudits.get(recipe.recipeId)?.readiness !== 'blocked'
      && recipeAllowed(recipe, {
        dietPreference,
        allergies,
        dislikes,
        whitelistCodes,
        foodsByCode,
        region,
      })
  ));
  const candidatesByCategory = new Map(['Breakfast', 'Lunch', 'Dinner', 'Snack'].map((category) => [
    category,
    eligibleRecipes.filter((recipe) => recipe.mealCategory === category),
  ]));

  const meals = [];
  const dailyNutrition = [];
  const diversityWarnings = new Set();
  let previousMainCombination = null;
  for (let day = 1; day <= days; day += 1) {
    const composedDay = composeDay(day, categories, candidatesByCategory, targetCalories, macroTargets, profile, foodsByCode, previousMainCombination);
    if (composedDay.status === 'unachievable') {
      return { status: 'unachievable', message: composedDay.message, targetCalories, macroTargets, meals: [] };
    }
    const dailyMeals = composedDay.meals.map((meal, index) => ({
      ...meal,
      scheduleLabel: schedule[index]?.name ?? meal.mealCategory,
      timing: schedule[index]?.time ?? null,
    }));
    if (composedDay.diversityWarning) diversityWarnings.add(composedDay.diversityWarning);
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
  const selectedAudits = [...new Set(meals.map(({ recipeId }) => recipeId))]
    .map((recipeId) => recipeAudits.get(recipeId));
  const nutritionWarnings = [...new Set(selectedAudits.flatMap((audit) => audit?.warnings ?? []))];
  const hasUnverifiedRecipeProvenance = nutritionWarnings.length > 0;
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
    diversityWarnings: [...diversityWarnings],
    disclaimer: [
      'This general nutrition plan is educational and is not medical advice. Consult a qualified healthcare professional for individual dietary needs.',
      ...diversityWarnings,
      hasUnverifiedRecipeProvenance
        ? `Recipe data limitations (not independently source-verified): ${nutritionWarnings.slice(0, 4).join(' ')} Nutrition totals use the recorded raw ingredient quantities and IFCT values.`
        : null,
    ].filter(Boolean).join(' '),
  };
}

export function generateBasicDietPlan(profile) {
  return composeRecipeMealPlan(profile);
}

export { calculateTargetCalories, calculateMacroTargets };
export default { generateBasicDietPlan, composeRecipeMealPlan, calculateTargetCalories, calculateMacroTargets, getPrimaryProteinSource };
