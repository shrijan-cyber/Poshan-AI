import MealPlan from '../models/MealPlan.js';
import { env } from '../config/env.js';
import { generateMealPlan, getMedicalDisclaimer } from '../services/aiService.js';
import logger from '../utils/logger.js';
import asyncHandler from '../utils/asyncHandler.js';
import httpError from '../utils/httpError.js';
import { enqueueMealPlanGeneration, getMealPlanJob } from '../jobs/mealPlanQueue.js';
import { getFoodByIfctCode } from '../rag/ragService.js';
import { getHouseholdFoodName } from '../rag/ifctLoader.js';
import { assertNoHighRiskConditions } from '../services/medicalConditionPolicy.js';

const groceryCategoryForIfct = (category) => {
  if (category === 'Milk and Milk Products') return 'Dairy';
  if (category === 'Cereals and Millets') return 'Grains';
  if (['Green Leafy Vegetables', 'Other Vegetables', 'Roots and Tubers', 'Mushrooms'].includes(category)) {
    return 'Vegetables';
  }
  if (category === 'Fruits') return 'Fruits';
  if (category === 'Grain Legumes') return 'Pulses';
  if (['Egg and Egg Products', 'Poultry', 'Animal Meat', 'Marine Fish', 'Marine Shellfish', 'Marine Mollusks', 'Fresh Water Fish and Shellfish'].includes(category)) {
    return 'Protein';
  }
  if (category === 'Edible Oils and Fats') return 'Oils & Fats';
  if (category === 'Condiments and Spices') return 'Spices';
  if (['Nuts and Oil Seeds', 'Sugars'].includes(category)) return category;
  return 'Other';
};

const formatGrams = (grams) => {
  const rounded = Math.round(grams * 10) / 10;
  if (rounded >= 1000 && rounded % 1000 === 0) return `${rounded / 1000}kg`;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}g`;
};

function storedRecipeIngredients(meal) {
  if (Array.isArray(meal.ingredients) && meal.ingredients.length > 0) {
    return meal.ingredients.map((ingredient) => ({
      ifctCode: ingredient.ifctCode ?? null,
      name: ingredient.canonicalName,
      quantity: formatGrams(Number(ingredient.rawQuantityGrams ?? ingredient.quantity) || 0),
      quantityGrams: Number(ingredient.rawQuantityGrams ?? ingredient.quantity) || 0,
      unit: ingredient.unit ?? 'g',
      state: ingredient.state ?? 'raw',
      householdMeasure: ingredient.householdMeasure ?? null,
      rawIngredientWeight: {
        quantityGrams: Number(ingredient.rawQuantityGrams ?? ingredient.quantity) || 0,
        unit: ingredient.unit ?? 'g',
        basis: 'raw',
      },
      cookedHouseholdMeasure: null,
      rawWeightGrams: Number(ingredient.rawWeightGrams ?? ingredient.rawQuantityGrams ?? ingredient.quantity) || 0,
      cookedWeightGrams: ingredient.cookedWeightGrams ?? null,
      yieldFactor: ingredient.yieldFactor ?? null,
      cookedServingDescription: ingredient.cookedServingDescription ?? null,
    }));
  }
  return (meal.items ?? []).map((item) => ({
    ifctCode: item.ifctCode,
    name: getHouseholdFoodName(getFoodByIfctCode(item.ifctCode) ?? { foodName: item.foodName }),
    quantity: formatGrams(Number(item.quantityGrams) || 0),
    quantityGrams: Number(item.quantityGrams) || 0,
    unit: 'g',
    state: item.weightBasis ?? 'raw',
    householdMeasure: item.householdMeasure ?? null,
    rawWeightGrams: Number(item.rawWeightGrams ?? item.rawIngredientWeight?.quantityGrams ?? item.quantityGrams) || 0,
    cookedWeightGrams: item.cookedWeightGrams ?? null,
    yieldFactor: item.yieldFactor ?? null,
    cookedServingDescription: item.cookedServingDescription ?? null,
  }));
}

async function generateSynchronously(req, res) {
  const mealPlan = await generateMealPlan(req.user._id, req.body.reportId, req.body.preferences);
  if (mealPlan.status === 'unachievable') {
    return res.status(422).json({
      success: false,
      status: 'unachievable',
      message: mealPlan.message,
      error: { code: 'RECIPE_TARGET_UNACHIEVABLE', message: mealPlan.message, requestId: req.id },
    });
  }
  return res.status(201).json({ success: true, data: publicMealPlan(mealPlan) });
}

async function findOwnedMealPlan(id, userId) {
  const mealPlan = await MealPlan.findOne({ _id: id, userId });
  if (!mealPlan) throw httpError(404, 'MEAL_PLAN_NOT_FOUND', 'Meal plan not found.');
  return mealPlan;
}

function publicMealPlan(mealPlan) {
  const plan = mealPlan.toObject();
  return {
    ...plan,
    meals: plan.meals.map((meal) => ({
      ...meal,
      cookedHouseholdMeasure: meal.cookedHouseholdMeasure ?? meal.portionDescription ?? null,
      cookedServingDescription: meal.cookedServingDescription ?? null,
      items: meal.items.map((item) => ({
        ...item,
        rawWeightGrams: item.rawWeightGrams ?? item.rawIngredientWeight?.quantityGrams ?? (Number(item.quantityGrams) || 0),
        cookedWeightGrams: item.cookedWeightGrams ?? null,
        yieldFactor: item.yieldFactor ?? null,
        cookedServingDescription: item.cookedServingDescription ?? null,
        rawIngredientWeight: item.rawIngredientWeight ?? {
          quantityGrams: Number(item.quantityGrams) || 0,
          unit: 'g',
        },
      })),
    })),
    disclaimer: plan.disclaimer ?? getMedicalDisclaimer(),
  };
}

export const generate = asyncHandler(async (req, res) => {
  assertNoHighRiskConditions(req.body.preferences?.conditions);
  // Development and tests are synchronous. Production queues when Redis is
  // healthy, and falls back to this path if enqueueing reports Redis unavailable.
  if (env.nodeEnv !== 'production') return generateSynchronously(req, res);

  const jobId = await enqueueMealPlanGeneration({
    userId: req.user._id,
    reportId: req.body.reportId,
    preferences: req.body.preferences,
  });
  if (!jobId) {
    logger.warn('Meal-plan queue unavailable; generating synchronously for this request.');
    return generateSynchronously(req, res);
  }
  return res.status(202).json({ success: true, data: { jobId, status: 'queued' } });
});

export const getGenerationStatus = asyncHandler(async (req, res) => {
  const job = await getMealPlanJob(req.params.jobId);
  if (!job || String(job.data?.userId) !== String(req.user._id)) {
    throw httpError(404, 'MEAL_PLAN_JOB_NOT_FOUND', 'Meal-plan generation job not found.');
  }
  const state = await job.getState();
  const payload = {
    jobId: job.id,
    status: state === 'completed' ? 'completed' : state === 'failed' ? 'failed' : state,
    ...(state === 'completed' && job.returnvalue?.status === 'unachievable'
      ? { status: 'unachievable', message: job.returnvalue.message }
      : state === 'completed' ? { planId: job.returnvalue?.planId } : {}),
    ...(state === 'failed' ? { message: 'Meal-plan generation failed. Please try again.' } : {}),
  };
  return res.json({ success: true, data: payload });
});

export const list = asyncHandler(async (req, res) => {
  const { page, limit } = req.pagination;
  const filter = { userId: req.user._id };
  const [mealPlans, total] = await Promise.all([
    MealPlan.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    MealPlan.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    data: {
      mealPlans: mealPlans.map(publicMealPlan),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

export const getById = asyncHandler(async (req, res) => {
  const mealPlan = await MealPlan.findOne({ _id: req.params.id, userId: req.user._id });
  if (!mealPlan) throw httpError(404, 'MEAL_PLAN_NOT_FOUND', 'Meal plan not found.');
  return res.json({ success: true, data: publicMealPlan(mealPlan) });
});

export const getGroceryList = asyncHandler(async (req, res) => {
  const mealPlan = await findOwnedMealPlan(req.params.id, req.user._id);
  const groupedItems = new Map();

  for (const meal of mealPlan.meals) {
    const items = Array.isArray(meal.ingredients) && meal.ingredients.length > 0
      ? meal.ingredients.map((ingredient) => ({
        ...ingredient,
        foodName: ingredient.canonicalName,
        quantityGrams: ingredient.rawWeightGrams ?? ingredient.rawQuantityGrams ?? ingredient.quantity,
      }))
      : meal.items;
    for (const item of items) {
      const food = getFoodByIfctCode(item.ifctCode);
      const name = food ? getHouseholdFoodName(food) : item.foodName;
      const category = groceryCategoryForIfct(food?.category);
      const normalizedName = name.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, ' ').trim();
      const key = `${item.ifctCode || 'unmapped'}:${normalizedName}`;
      const current = groupedItems.get(key) ?? { category, name, grams: 0 };
      current.grams += Number(item.quantityGrams) || 0;
      groupedItems.set(key, current);
    }
  }

  const categories = new Map();
  for (const { category, name, grams } of groupedItems.values()) {
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push({ name, quantity: formatGrams(grams) });
  }

  const groceryList = [...categories.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }));

  return res.json({ success: true, data: { mealPlanId: String(mealPlan._id), groceryList } });
});

export const getRecipes = asyncHandler(async (req, res) => {
  const mealPlan = await findOwnedMealPlan(req.params.id, req.user._id);
  const recipes = mealPlan.meals.map((meal) => ({
    recipeId: meal.recipeId ?? null,
    day: meal.day,
    mealType: meal.mealType,
    title: meal.dishName ?? `${meal.mealType[0].toUpperCase()}${meal.mealType.slice(1)} — Day ${meal.day}`,
    dishName: meal.dishName ?? meal.recipeId ?? null,
    servings: meal.servings ?? null,
    portionDescription: meal.portionDescription ?? null,
    preparationTime: meal.prepTime ?? null,
    cookingTime: meal.cookTime ?? null,
    ingredients: storedRecipeIngredients(meal),
    steps: meal.recipeInstructions?.length
      ? meal.recipeInstructions
      : (Array.isArray(meal.cookingInstructions) ? meal.cookingInstructions : []),
  }));

  return res.json({ success: true, data: { mealPlanId: String(mealPlan._id), recipes } });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const mealPlan = await MealPlan.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: { status: req.body.status } },
    { new: true, runValidators: true },
  );
  if (!mealPlan) throw httpError(404, 'MEAL_PLAN_NOT_FOUND', 'Meal plan not found.');
  logger.info('Meal-plan status updated.');
  return res.json({ success: true, data: publicMealPlan(mealPlan) });
});

export default { generate, getGenerationStatus, list, getById, getGroceryList, getRecipes, updateStatus };
