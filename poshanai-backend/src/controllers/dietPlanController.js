import DietPlan from '../models/DietPlan.js';
import MealPlan from '../models/MealPlan.js';
import { enhanceDietPlan } from '../services/aiService.js';
import { generateBasicDietPlan } from '../services/dietService.js';
import { buildGroceryList } from '../services/groceryService.js';
import asyncHandler from '../utils/asyncHandler.js';
import httpError from '../utils/httpError.js';
import { assertNoHighRiskConditions } from '../services/medicalConditionPolicy.js';

function publicDietPlan(dietPlan) {
  const plan = typeof dietPlan.toObject === 'function' ? dietPlan.toObject() : dietPlan;
  return {
    ...plan,
    meals: (plan.meals ?? []).map((meal) => ({
      ...meal,
      cookedHouseholdMeasure: meal.cookedHouseholdMeasure ?? meal.portionDescription ?? null,
      cookedServingDescription: meal.cookedServingDescription ?? null,
      items: (meal.items ?? []).map((item) => ({
        ...item,
        weightBasis: item.weightBasis ?? 'raw',
        householdMeasure: item.householdMeasure ?? null,
        rawWeightGrams: item.rawWeightGrams ?? item.rawIngredientWeight?.quantityGrams ?? (Number(item.quantity) || null),
        cookedWeightGrams: item.cookedWeightGrams ?? null,
        yieldFactor: item.yieldFactor ?? null,
        cookedServingDescription: item.cookedServingDescription ?? null,
        rawIngredientWeight: item.rawIngredientWeight ?? {
          quantityGrams: Number(item.quantity) || 0,
          unit: 'g',
        },
      })),
    })),
  };
}

export const generateBasic = asyncHandler(async (req, res) => {
  assertNoHighRiskConditions(req.body.conditions);
  const profile = {
    ...req.body,
    dietType: req.body.dietType === 'non-veg' ? 'nonveg' : req.body.dietType,
  };
  const composed = generateBasicDietPlan(profile);
  if (composed.status === 'unachievable') {
    return res.status(422).json({
      success: false,
      status: 'unachievable',
      message: composed.message,
      error: { code: 'RECIPE_TARGET_UNACHIEVABLE', message: composed.message, requestId: req.id },
    });
  }
  const generated = await enhanceDietPlan(composed);
  const dietPlan = await DietPlan.create({
    ...generated,
    groceryList: buildGroceryList(generated),
    conditions: req.body.conditions,
    userId: req.user._id,
  });
  return res.status(201).json({ success: true, data: publicDietPlan(dietPlan) });
});

export const getGroceryList = asyncHandler(async (req, res) => {
  const dietPlan = await DietPlan.findOne({ _id: req.params.id, userId: req.user._id });
  if (!dietPlan) throw httpError(404, 'DIET_PLAN_NOT_FOUND', 'Diet plan not found.');

  // Grocery data is derived from the saved portions, not nutrition. Rebuild from
  // the single loaded document so older cached lists and newly structured meals
  // both resolve to the same response contract without another database query.
  const groceryList = buildGroceryList(dietPlan);
  if (JSON.stringify(dietPlan.groceryList ?? []) !== JSON.stringify(groceryList)) {
    dietPlan.groceryList = groceryList;
    await dietPlan.save();
  }

  return res.json({
    success: true,
    data: { dietPlanId: String(dietPlan._id), groceryList },
  });
});

export const list = asyncHandler(async (req, res) => {
  const filter = { userId: req.user._id };
  const [basicPlans, personalizedPlans] = await Promise.all([
    DietPlan.find(filter).sort({ createdAt: -1 }).limit(100).lean(),
    MealPlan.find(filter).sort({ createdAt: -1 }).limit(100).lean(),
  ]);
  const plans = [
    ...basicPlans.map(publicDietPlan),
    ...personalizedPlans.map((plan) => ({ ...plan, type: 'personalized' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ success: true, data: { plans } });
});

export default { generateBasic, getGroceryList, list };
