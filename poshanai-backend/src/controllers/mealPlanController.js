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

const mealCategory = (item) => getFoodByIfctCode(item.ifctCode)?.category ?? 'Miscellaneous Foods';

function recipeSteps(meal) {
  const categories = meal.items.map(mealCategory);
  const hasVegetables = categories.some((category) => ['Green Leafy Vegetables', 'Other Vegetables', 'Roots and Tubers', 'Mushrooms'].includes(category));
  const hasPulses = categories.includes('Grain Legumes');
  const hasGrains = categories.includes('Cereals and Millets');
  const preparation = hasVegetables
    ? 'Wash and chop the vegetables; rinse any grains or pulses.'
    : hasPulses || hasGrains
      ? 'Rinse the grains and pulses, then measure the listed ingredients.'
      : 'Measure and prepare the listed ingredients.';
  const cooking = String(meal.cookingInstructions ?? '').trim()
    || (hasPulses ? 'Pressure-cook the pulses until soft, using minimal oil.' : 'Cook the ingredients until tender, using minimal oil.');
  const finish = hasPulses && hasGrains
    ? 'Combine the cooked dal and grains, adjust the consistency, and serve warm.'
    : hasVegetables
      ? 'Combine the cooked ingredients and serve warm.'
      : 'Check that everything is cooked through, then serve warm.';
  return [preparation, cooking, finish];
}

async function generateSynchronously(req, res) {
  const mealPlan = await generateMealPlan(req.user._id, req.body.reportId, req.body.preferences);
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
      items: meal.items.map((item) => ({
        ...item,
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
    ...(state === 'completed' ? { planId: job.returnvalue?.planId } : {}),
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
    for (const item of meal.items) {
      const food = getFoodByIfctCode(item.ifctCode);
      const name = food ? getHouseholdFoodName(food) : item.foodName;
      const category = groceryCategoryForIfct(food?.category);
      const key = `${category}:${item.ifctCode || name.toLowerCase()}`;
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
    day: meal.day,
    mealType: meal.mealType,
    title: `${meal.mealType[0].toUpperCase()}${meal.mealType.slice(1)} — Day ${meal.day}`,
    ingredients: meal.items.map((item) => ({
      name: (() => {
        const food = getFoodByIfctCode(item.ifctCode);
        return food ? getHouseholdFoodName(food) : item.foodName;
      })(),
      quantity: formatGrams(Number(item.quantityGrams) || 0),
      rawIngredientWeight: {
        ...(item.rawIngredientWeight ?? {
          quantityGrams: Number(item.quantityGrams) || 0,
          unit: 'g',
        }),
        basis: item.weightBasis ?? 'raw',
      },
      cookedHouseholdMeasure: item.householdMeasure ?? null,
    })),
    cookedHouseholdMeasure: meal.portionDescription ?? null,
    steps: recipeSteps(meal),
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
