import Joi from 'joi';
import MealPlan from '../models/MealPlan.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import LifestyleProfile from '../models/LifestyleProfile.js';
import { getHouseholdFoodName, getIfctFoods } from '../rag/ifctLoader.js';
import { env } from '../config/env.js';
import { getMedicalDisclaimer } from '../rag/ragService.js';
import { hasSevereB12Deficiency } from '../rag/promptBuilder.js';
import logger from '../utils/logger.js';
import httpError from '../utils/httpError.js';
import { assertNoHighRiskConditions } from './medicalConditionPolicy.js';
import { composeRecipeMealPlan } from './dietService.js';
import { createChatCompletionProvider } from './aiProviders/chatCompletionProvider.js';

const recipeInstructionSystemPrompt = [
  'You are a practical Indian household cooking assistant.',
  'The backend has already selected the recipes and calculated all nutrition. Do not select, remove, rename, or invent recipes, foods, ingredients, quantities, calories, macros, or nutrition claims.',
  'Use only ingredients listed for each supplied recipe. Return short, friendly cooking instructions that fit ordinary Indian home kitchens.',
  'Use only the supplied recipeId and mealIndex. Return exactly one entry per supplied meal.',
  'No validated substitution catalog is available, so swapSuggestion must be null.',
  'Return JSON only: {"recipes":[{"mealIndex":0,"recipeId":"...","cookingInstructions":["..."],"swapSuggestion":null}]}.',
].join(' ');

const recipeInstructionResponseSchema = Joi.object({
  recipes: Joi.array().items(Joi.object({
    mealIndex: Joi.number().integer().min(0).required(),
    recipeId: Joi.string().trim().min(1).max(80).required(),
    cookingInstructions: Joi.array().items(Joi.string().trim().min(8).max(300)).min(1).max(8).required(),
    swapSuggestion: Joi.valid(null).default(null),
  }).unknown(false)).min(1).max(300).required(),
}).unknown(false);

function getRecipeInstructionProvider() {
  if (env.aiProvider === 'omniroute') {
    return createChatCompletionProvider({
      endpoint: env.omniroutePocUrl,
      model: env.omniroutePocModel,
      apiKey: env.omniroutePocApiKey,
      timeoutMs: env.aiRequestTimeoutMs,
      maxRetries: env.aiRequestMaxRetries,
      providerName: 'OmniRoute POC',
    });
  }
  // Backward-compatible existing Gemini-model route; current source uses an
  // OpenAI-compatible endpoint with gemini-2.0-flash as its default model.
  return createChatCompletionProvider({
    endpoint: env.omniRouteUrl,
    model: env.omniRouteModel,
    apiKey: env.omniRouteApiKey,
    timeoutMs: env.aiRequestTimeoutMs,
    maxRetries: env.aiRequestMaxRetries,
    providerName: 'Existing AI route',
  });
}

function staticInstructions(meal) {
  const instructions = meal.recipeInstructions ?? meal.cookingInstructions;
  if (Array.isArray(instructions)) return instructions;
  return typeof instructions === 'string' && instructions.trim() ? [instructions.trim()] : [];
}

const ingredientAliases = new Map([
  ['onion', ['onion', 'onions', 'pyaaz']], ['tomato', ['tomato', 'tomatoes']],
  ['spinach', ['spinach', 'palak']],
  ['spinach', ['spinach', 'palak']], ['potato', ['potato', 'potatoes', 'aloo']],
  ['paneer', ['paneer']], ['milk', ['milk']], ['egg', ['egg', 'eggs']],
  ['chicken', ['chicken']], ['fish', ['fish']], ['oil', ['oil']], ['ghee', ['ghee']],
  ['wheat flour, atta', ['atta', 'wheat flour', 'roti', 'chapati']],
  ['rice flakes', ['poha', 'flattened rice']], ['green gram, dal', ['moong dal', 'green gram']],
  ['red gram, dal', ['toor dal', 'arhar dal', 'red gram']], ['lentil dal', ['masoor dal', 'lentil']],
  ['rajmah', ['rajma']], ['bengal gram, whole', ['chole', 'chana', 'chickpeas']],
  ['soya bean', ['soy', 'soya', 'soybean', 'soya chunks', 'tofu']],
]);
const commonIngredientTerms = [
  'curd', 'dahi', 'yogurt', 'yoghurt', 'water', 'oil', 'ghee', 'salt', 'spice', 'spices', 'masala',
  'spinach', 'palak', 'onion', 'pyaaz', 'tomato', 'potato', 'aloo', 'paneer', 'milk', 'egg', 'chicken', 'fish',
];

function foodTerms(food) {
  const terms = new Set([food.foodName, getHouseholdFoodName(food)]);
  const lowerName = String(food.foodName ?? '').toLowerCase();
  const prefix = lowerName.split(',')[0].trim();
  if (/^(?:onion|tomato|spinach|potato|paneer|milk|egg|chicken|fish|oil|ghee|garlic|ginger|cumin|turmeric|chilli|chili)$/.test(prefix)) terms.add(prefix);
  for (const [catalogName, aliases] of ingredientAliases) {
    if (lowerName.includes(catalogName) || String(getHouseholdFoodName(food)).toLowerCase() === catalogName) {
      aliases.forEach((alias) => terms.add(alias));
    }
  }
  const foodCategory = String(food.category ?? '').toLowerCase();
  if (/condiments and spices/.test(foodCategory)) {
    const spice = lowerName.split(',')[0].trim();
    if (spice.length >= 4) terms.add(spice);
  }
  return [...terms].map((term) => String(term).trim().toLowerCase()).filter((term) => term.length >= 3);
}

function containsUnlistedFood(instruction, allowedCodes) {
  const text = String(instruction).toLocaleLowerCase('en');
  const catalog = getIfctFoods();
  const allowedTerms = new Set(getIfctFoods()
    .filter((food) => allowedCodes.has(food.ifctCode))
    .flatMap(foodTerms));
  const allTerms = new Set([...commonIngredientTerms, ...catalog.flatMap(foodTerms)]);
  return [...allTerms].some((term) => {
    if (allowedTerms.has(term)) return false;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}(?:s|es)?\\b`, 'i').test(text);
  });
}

function safeFallbackInstructions(meal) {
  const instructions = staticInstructions(meal);
  const allowedCodes = new Set((meal.ingredients ?? []).map(({ ifctCode }) => ifctCode).filter(Boolean));
  if (instructions.length && instructions.every((step) => !containsUnlistedFood(step, allowedCodes))) return instructions;
  return [
    'Prepare the listed ingredients for this dish.',
    'Cook the listed ingredients using a simple household method suitable for the dish; do not add unlisted ingredients.',
    'Serve the prepared dish.',
  ];
}

/** The model may polish instructions for fixed recipes; all food and nutrition remain backend-owned. */
export async function enhanceRecipeInstructions(meals) {
  if (!Array.isArray(meals)) throw httpError(422, 'RECIPES_REQUIRED', 'A selected recipe list is required.');
  const fallbacks = meals.map((meal) => {
    const instructions = safeFallbackInstructions(meal);
    return { ...meal, recipeInstructions: instructions, cookingInstructions: instructions, swapSuggestion: null };
  });
  if (!meals.length) return fallbacks;

  try {
    const mealInputs = meals.map((meal, mealIndex) => ({
      mealIndex,
      recipeId: meal.recipeId,
      dishName: meal.dishName ?? meal.mealName,
      ingredients: (meal.ingredients ?? []).map(({ ifctCode, canonicalName, quantity, unit, householdMeasure }) => ({
        ifctCode,
        name: canonicalName,
        quantity,
        unit,
        householdMeasure,
      })),
    }));
    const prompt = [
      'Write simple household cooking steps for the already-selected recipes below.',
      'Do not change their dishes, ingredients, IFCT references, quantities, or nutrition. Do not mention any food outside each recipe ingredient list.',
      'Return exactly one result for each mealIndex and preserve its recipeId. swapSuggestion must be null.',
      JSON.stringify({ recipes: mealInputs }),
    ].join('\n');
    const { content: responseText } = await getRecipeInstructionProvider()([
      { role: 'system', content: recipeInstructionSystemPrompt },
      { role: 'user', content: prompt },
    ]);
    const cleaned = responseText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    const { error, value } = recipeInstructionResponseSchema.validate(parsed, { abortEarly: false, convert: true });
    if (error || value.recipes.length !== meals.length) throw new Error('AI recipe instructions had an invalid shape.');

    const byIndex = new Map();
    for (const recipe of value.recipes) {
      if (recipe.mealIndex >= meals.length || byIndex.has(recipe.mealIndex)) throw new Error('AI recipe instruction index was invalid.');
      const source = meals[recipe.mealIndex];
      if (recipe.recipeId !== source.recipeId) throw new Error('AI changed the selected recipe identifier.');
      const allowedCodes = new Set((source.ingredients ?? []).map(({ ifctCode }) => ifctCode));
      if (recipe.cookingInstructions.some((step) => containsUnlistedFood(step, allowedCodes))) {
        throw new Error('AI instructions referenced a food outside the selected recipe.');
      }
      byIndex.set(recipe.mealIndex, recipe);
    }
    if (byIndex.size !== meals.length) throw new Error('AI omitted recipe instructions.');
    return meals.map((meal, mealIndex) => {
      const recipe = byIndex.get(mealIndex);
      return { ...meal, cookingInstructions: recipe.cookingInstructions, recipeInstructions: recipe.cookingInstructions, swapSuggestion: null };
    });
  } catch {
    logger.warn('AI recipe instructions unavailable; using the static recipe directions.');
    return fallbacks;
  }
}

export async function enhanceDietPlan(plan) {
  if (!plan || !Array.isArray(plan.meals)) {
    throw httpError(422, 'DIET_PLAN_INVALID', 'A meal plan is required for AI enhancement.');
  }
  return {
    ...plan,
    meals: await enhanceRecipeInstructions(plan.meals),
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function getCalculatedItem(food, ifctCode, quantityGrams) {
  const nutrients = Object.fromEntries(
    Object.entries(food.nutrients).map(([nutrient, perHundredGrams]) => [
      nutrient,
      perHundredGrams === null || perHundredGrams === undefined || !Number.isFinite(Number(perHundredGrams))
        ? null
        : round((perHundredGrams * quantityGrams) / 100),
    ]),
  );
  return {
    foodName: getHouseholdFoodName(food),
    ifctCode,
    quantityGrams,
    weightBasis: 'raw',
    householdMeasure: null,
    rawIngredientWeight: { quantityGrams, unit: 'g' },
    nutrients,
  };
}

function getProteinSupplement(foodByCode, dietType) {
  const candidates = {
    veg: [['L003', 100], ['B010', 50], ['B013', 50], ['B021', 50], ['B001', 50]],
    eggetarian: [['M004', 100], ['L003', 100], ['B010', 50], ['B013', 50]],
    nonveg: [['M004', 100], ['N003', 100], ['L003', 100], ['B010', 50]],
    vegan: [['B024', 50], ['B025', 50], ['B010', 50], ['B013', 50]],
  };
  return (candidates[dietType] ?? candidates.veg)
    .map(([code]) => ({ food: foodByCode.get(code) }))
    .find(({ food }) => food && Number(food.nutrients?.protein) > 0) ?? null;
}

export function buildStoredMeals(generatedMeals, foodByCode, dietType = 'veg', proteinTargetGrams = null) {
  const supplement = getProteinSupplement(foodByCode, dietType);

  return generatedMeals.map(({ day, mealType, nutrientTargets, proteinSource, cookingInstructions, items }) => {
    const storedItems = items.map(({ ifctCode, foodName, quantityGrams }) => {
      const food = foodByCode.get(ifctCode);
      if (!food || food.foodName !== foodName) {
        throw httpError(502, 'AI_RESPONSE_INVALID', 'OmniRoute selected an IFCT food that was not provided.');
      }
      return getCalculatedItem(food, ifctCode, quantityGrams);
    });
    let verifiedProteinSource = items
      .map(({ ifctCode }) => foodByCode.get(ifctCode))
      .find((food) => food?.foodName.toLowerCase() === proteinSource.toLowerCase() && food.nutrients.protein > 0);
    if (!verifiedProteinSource) {
      throw httpError(502, 'AI_RESPONSE_INVALID', 'OmniRoute did not select a verified protein food for a meal.');
    }

    const proteinTotal = () => round(storedItems.reduce((total, item) => total + (item.nutrients.protein ?? 0), 0));
    const target = Number(proteinTargetGrams);
    if (Number.isFinite(target) && target > 0 && proteinTotal() < target && supplement) {
      const existingSupplement = storedItems.find((item) => item.ifctCode === supplement.food.ifctCode);
      const missingProtein = target - proteinTotal();
      const proteinPer100g = Number(supplement.food.nutrients.protein);
      const additionalGrams = Math.ceil((missingProtein * 100) / proteinPer100g);
      const currentMealGrams = storedItems.reduce((total, item) => total + item.quantityGrams, 0);
      const portionLimit = Math.max(0, 1000 - currentMealGrams);
      const supplementGrams = Math.min(additionalGrams, portionLimit);
      if (supplementGrams <= 0) {
        throw httpError(422, 'MEAL_PROTEIN_TARGET_UNMET', 'The meal portions cannot meet the protein target within the 1000 g meal limit.');
      }
      if (existingSupplement) {
        const adjustedQuantity = existingSupplement.quantityGrams + supplementGrams;
        existingSupplement.quantityGrams = adjustedQuantity;
        Object.assign(existingSupplement, getCalculatedItem(supplement.food, existingSupplement.ifctCode, adjustedQuantity));
      } else {
        storedItems.push(getCalculatedItem(supplement.food, supplement.food.ifctCode, supplementGrams));
      }
      verifiedProteinSource = supplement.food;
    }

    if (Number.isFinite(target) && target > 0 && proteinTotal() < target) {
      throw httpError(422, 'MEAL_PROTEIN_TARGET_UNMET', 'The generated meal could not meet its backend-calculated protein target.');
    }

    return {
      day,
      mealType,
      nutrientTargets,
      proteinSource: getHouseholdFoodName(verifiedProteinSource),
      cookingInstructions,
      items: storedItems,
    };
  });
}

export function validateGeneratedMealPlan(meals, expectedDays = 7, expectedMealsPerDay = 3) {
  if (!Array.isArray(meals) || meals.length === 0) {
    throw httpError(422, 'MEAL_PLAN_INVALID', 'The generated meal plan contains no meals.');
  }
  const mealsByDay = new Map();
  for (const meal of meals) {
    const grams = meal.items.reduce((total, item) => total + Number(item.quantityGrams || 0), 0);
    if (grams > 1000) {
      throw httpError(422, 'MEAL_PORTION_TOO_LARGE', 'A meal portion exceeds the 1000 g safety limit. Please regenerate the plan.');
    }
    const dayMeals = mealsByDay.get(meal.day) ?? [];
    dayMeals.push(meal);
    mealsByDay.set(meal.day, dayMeals);
  }

  if (mealsByDay.size !== expectedDays) {
    throw httpError(422, 'MEAL_PLAN_INCOMPLETE', 'The meal plan must include all seven days.');
  }

  for (let day = 1; day <= expectedDays; day += 1) {
    const dayMeals = mealsByDay.get(day) ?? [];
    const types = new Set(dayMeals.map(({ mealType }) => mealType));
    if (dayMeals.length < expectedMealsPerDay
      || (expectedMealsPerDay >= 3 && (!types.has('breakfast') || !types.has('lunch') || (!types.has('dinner') && !types.has('snack'))))) {
      throw httpError(422, 'MEAL_PLAN_INCOMPLETE', `Day ${day} must include breakfast, lunch, and dinner or a snack.`);
    }

    const hasCompleteEnergyData = dayMeals.every((meal) => meal.items.every((item) => Number.isFinite(item.nutrients?.calories)));
    if (hasCompleteEnergyData) {
      const dailyCalories = dayMeals.reduce((total, meal) => total
        + meal.items.reduce((mealTotal, item) => mealTotal + item.nutrients.calories, 0), 0);
      if (dailyCalories < 1200 || dailyCalories > 4000) {
        throw httpError(422, 'MEAL_PLAN_CALORIES_UNREALISTIC', `Day ${day} totals ${round(dailyCalories)} kcal, outside the supported 1200–4000 kcal range.`);
      }
    }
  }
  return true;
}

/**
 * Generates and persists a validated seven-day meal plan for an owned report.
 */
export async function generateMealPlan(userId, reportId, preferences = {}) {
  assertNoHighRiskConditions(preferences.conditions);
  const user = await User.findById(userId).select('_id profile').lean();
  if (!user) throw httpError(404, 'USER_NOT_FOUND', 'User profile not found.');
  const lifestyleProfile = await LifestyleProfile.findOne({ userId }).lean();

  const report = await Report.findOne({ _id: reportId, userId });
  if (!report) throw httpError(404, 'REPORT_NOT_FOUND', 'Report not found.');
  if (report.ocrStatus !== 'completed') {
    throw httpError(409, 'REPORT_NOT_READY', 'The report must finish processing before generating a meal plan.');
  }
  if (!['confirmed', 'corrected'].includes(report.reviewStatus)) {
    throw httpError(409, 'REPORT_REVIEW_REQUIRED', 'Confirm or correct the extracted report values before generating a meal plan.');
  }

  const deficiencies = report.extractedValues
    .filter(({ flag }) => flag === 'low')
    .map(({ nutrient, value, unit, normalizedValue, normalizedUnit, flag }) => ({
      nutrient, value, unit, normalizedValue, normalizedUnit, flag,
    }));
  const householdDiet = [
    ...(lifestyleProfile?.typicalDiet ?? []),
    lifestyleProfile?.dailyDietDescription ?? '',
  ].map((value) => String(value).trim()).filter(Boolean).join('; ').slice(0, 600);
  const effectivePreferences = {
    ...preferences,
    dietType: preferences.dietType ?? lifestyleProfile?.dietType ?? user.profile?.dietType ?? 'veg',
    region: preferences.region ?? lifestyleProfile?.region ?? user.profile?.region ?? null,
    householdDiet,
  };
  const recipeProfile = {
    age: lifestyleProfile?.age ?? user.profile?.age,
    gender: lifestyleProfile?.gender ?? user.profile?.gender,
    weightKg: lifestyleProfile?.weightKg ?? user.profile?.weightKg,
    heightCm: lifestyleProfile?.heightCm ?? user.profile?.heightCm,
    activityLevel: preferences.activityLevel ?? lifestyleProfile?.activityLevel ?? user.profile?.activityLevel,
    goal: preferences.goal ?? 'maintain',
    dietType: effectivePreferences.dietType,
    mealsPerDay: Number(lifestyleProfile?.mealsPerDay) || 3,
    region: effectivePreferences.region,
    allergies: preferences.allergies ?? [],
    dislikes: preferences.dislikes ?? [],
    preferredFoods: preferences.preferredFoods ?? [],
    typicalDiet: householdDiet,
  };

  logger.info('Deterministic recipe-plan generation started.');
  const composedPlan = composeRecipeMealPlan(recipeProfile, { days: 7 });
  if (composedPlan.status === 'unachievable') return composedPlan;
  const instructedMeals = await enhanceRecipeInstructions(composedPlan.meals);
  const nutrientTargets = [...new Set(deficiencies.map(({ nutrient }) => nutrient))].slice(0, 5);
  const meals = instructedMeals.map((meal) => {
    return {
      ...meal,
      nutrientTargets,
      proteinSource: meal.primaryProteinSource ?? null,
      cookingInstructions: meal.cookingInstructions.join(' ').slice(0, 300),
    };
  });
  validateGeneratedMealPlan(meals, 7, recipeProfile.mealsPerDay);
  const ragSourcesUsed = [...new Set(meals.flatMap((meal) => meal.items.map((item) => item.ifctCode)))];
  const disclaimer = getMedicalDisclaimer();

  const mealPlan = await MealPlan.create({
    userId,
    reportId,
    preferences: {
      dietType: effectivePreferences.dietType,
      allergies: effectivePreferences.allergies ?? [],
      region: effectivePreferences.region,
      activityLevel: recipeProfile.activityLevel,
    },
    householdDiet: effectivePreferences.householdDiet,
    targetDeficiencies: deficiencies.map(({ nutrient }) => nutrient),
    targetCalories: composedPlan.targetCalories,
    macroTargets: composedPlan.macroTargets,
    planDurationDays: 7,
    meals,
    diversityWarnings: composedPlan.diversityWarnings ?? [],
    supplementGuidance: hasSevereB12Deficiency(deficiencies)
      ? 'Discuss a clinician-supervised vitamin B12 supplement with your healthcare professional. They should decide whether it is appropriate and determine the dose and duration; do not self-medicate.'
      : null,
    aiModelUsed: env.omniRouteModel,
    ragSourcesUsed,
    disclaimer,
    status: 'draft',
  });
  logger.info('Meal plan generated and saved.');
  return mealPlan;
}

export { getMedicalDisclaimer };

export default { generateMealPlan, enhanceDietPlan, getMedicalDisclaimer };
