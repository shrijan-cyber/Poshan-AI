import mongoose from 'mongoose';
import { createRequire } from 'node:module';
import DietPlan from '../models/DietPlan.js';
import MealPlan from '../models/MealPlan.js';
import { env } from '../config/env.js';
import {
  addDietPlanNutritionAvailability,
  addMealPlanNutritionAvailability,
} from '../services/planNutritionCompatibility.js';

if (!process.argv.includes('--confirm-read-only')) {
  throw new Error('This read-only database preview requires --confirm-read-only. It never writes plan data.');
}

const require = createRequire(import.meta.url);
const manifest = require('../data/ifct-manifest.json');
const macroFields = ['calories', 'protein', 'carbs', 'fat'];
const verifiedProvenance = manifest.dataset?.source?.sourceFileAvailable === true
  && manifest.dataset?.source?.sourceColumnMappingVerified === true
  && macroFields.every((field) => manifest.nutrientFields?.[field]?.mappingStatus === 'verified'
    && manifest.nutrientFields?.[field]?.sourceUnit);

function hasRawIngredientReferences(meals = []) {
  return meals.length > 0 && meals.every((meal) => {
    const ingredients = Array.isArray(meal.ingredients) && meal.ingredients.length
      ? meal.ingredients
      : meal.items;
    return Array.isArray(ingredients) && ingredients.length > 0 && ingredients.every((ingredient) => {
      const rawWeight = ingredient.rawWeightGrams
        ?? ingredient.rawQuantityGrams
        ?? ingredient.rawIngredientWeight?.quantityGrams;
      return typeof ingredient.ifctCode === 'string'
        && Number.isFinite(Number(rawWeight))
        && Number(rawWeight) > 0;
    });
  });
}

function summarize(plans, annotate) {
  const counts = { total: plans.length, stored: 0, incomplete: 0, unavailable: 0 };
  let withRawIngredientReferences = 0;
  for (const plan of plans) {
    const status = annotate(plan).nutritionAvailability.status;
    counts[status] += 1;
    if (hasRawIngredientReferences(plan.meals)) withRawIngredientReferences += 1;
  }
  return {
    ...counts,
    withRawIngredientReferences,
    safeRecalculationCandidates: verifiedProvenance ? withRawIngredientReferences : 0,
  };
}

try {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
  const projection = [
    'dailyNutrition',
    'meals.calories', 'meals.macros',
    'meals.items.ifctCode', 'meals.items.rawWeightGrams', 'meals.items.rawIngredientWeight', 'meals.items.quantity',
    'meals.ingredients.ifctCode', 'meals.ingredients.rawWeightGrams', 'meals.ingredients.rawQuantityGrams', 'meals.ingredients.quantity',
  ].join(' ');
  const [basicPlans, reportPlans] = await Promise.all([
    DietPlan.find({}).select(`${projection} -_id`).lean(),
    MealPlan.find({}).select(`${projection} -_id`).lean(),
  ]);

  process.stdout.write(`${JSON.stringify({
    mode: 'read-only-preview',
    modifiedDocuments: 0,
    provenanceVerified: verifiedProvenance,
    provenanceReason: verifiedProvenance
      ? null
      : 'IFCT source file, column/unit mapping, or record provenance is not verified.',
    basicPlans: summarize(basicPlans, addDietPlanNutritionAvailability),
    reportPlans: summarize(reportPlans, addMealPlanNutritionAvailability),
  }, null, 2)}\n`);
} finally {
  await mongoose.disconnect();
}
