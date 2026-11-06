import { createRequire } from 'node:module';
import { getIfctFoods } from '../rag/ifctLoader.js';

const require = createRequire(import.meta.url);
const recipeTemplates = require('../data/recipes.json');
const PRIMARY_NUTRIENTS = ['calories', 'protein', 'carbs', 'fat'];
const NUTRIENTS = [...PRIMARY_NUTRIENTS, 'iron', 'calcium', 'vitaminD', 'vitaminB12', 'fiber'];
const round2 = (value) => Math.round(value * 100) / 100;

function positiveFinite(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function energyDeviation(nutrition) {
  const macroCalories = (nutrition.protein * 4) + (nutrition.carbs * 4) + (nutrition.fat * 9);
  return nutrition.calories > 0
    ? Math.abs(macroCalories - nutrition.calories) / nutrition.calories
    : Infinity;
}

/**
 * Recompute ingredient nutrition from raw grams and IFCT values. A null nutrient
 * remains null if any contributing IFCT record is missing that nutrient.
 * This function is diagnostic and never changes catalog or persisted records.
 */
export function calculateRecipeNutrition(recipe, foods = getIfctFoods(), scaleFactor = 1) {
  if (!recipe || !Array.isArray(recipe.ingredients) || !positiveFinite(scaleFactor)) {
    throw new TypeError('A recipe with ingredients and a positive scale factor is required.');
  }
  const foodsByCode = new Map(foods.map((food) => [food.ifctCode, food]));
  const wholeRecipe = Object.fromEntries(NUTRIENTS.map((key) => [key, 0]));
  let primaryAvailable = true;
  let ingredientsValid = true;

  for (const ingredient of recipe.ingredients) {
    const food = foodsByCode.get(ingredient.ifctCode);
    if (!food || !positiveFinite(ingredient.rawQuantityGrams)) {
      primaryAvailable = false;
      ingredientsValid = false;
      continue;
    }
    const grams = Number(ingredient.rawQuantityGrams) * scaleFactor;
    for (const key of NUTRIENTS) {
      const per100g = food.nutrients?.[key];
      if (per100g === null || per100g === undefined || !Number.isFinite(Number(per100g))) {
        if (PRIMARY_NUTRIENTS.includes(key)) primaryAvailable = false;
        wholeRecipe[key] = null;
      } else if (wholeRecipe[key] !== null) {
        wholeRecipe[key] += (Number(per100g) * grams) / 100;
      }
    }
  }

  if (!ingredientsValid) {
    for (const key of NUTRIENTS) wholeRecipe[key] = null;
  }

  const normalizedWhole = Object.fromEntries(NUTRIENTS.map((key) => [
    key,
    wholeRecipe[key] === null || !Number.isFinite(wholeRecipe[key]) ? null : round2(wholeRecipe[key]),
  ]));
  const servings = Number(recipe.servings);
  const perServing = positiveFinite(servings)
    ? Object.fromEntries(NUTRIENTS.map((key) => [
      key,
      normalizedWhole[key] === null ? null : round2(normalizedWhole[key] / servings),
    ]))
    : Object.fromEntries(NUTRIENTS.map((key) => [key, null]));

  return {
    available: primaryAvailable && PRIMARY_NUTRIENTS.every((key) => Number.isFinite(normalizedWhole[key])),
    scaleFactor,
    wholeRecipe: normalizedWhole,
    perServing,
    macroEnergyDeviation: normalizedWhole.calories !== null
      && normalizedWhole.protein !== null && normalizedWhole.carbs !== null && normalizedWhole.fat !== null
      ? energyDeviation(normalizedWhole)
      : null,
  };
}

function isCookingFat(food) {
  return /oil|ghee|edible oils and fats/i.test(`${food?.foodName ?? ''} ${food?.category ?? ''}`);
}

/** Audit one recipe. Missing provenance is a warning; invalid data blocks use. */
export function auditRecipeProvenance(recipe, foods = getIfctFoods()) {
  const errors = [];
  const warnings = [];
  const foodsByCode = new Map(foods.map((food) => [food.ifctCode, food]));
  if (!recipe || typeof recipe !== 'object' || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    return {
      recipeId: recipe?.recipeId ?? null,
      dishName: recipe?.dishName ?? null,
      readiness: 'blocked',
      errors: ['Recipe must contain at least one structured ingredient.'],
      warnings,
      nutrition: null,
    };
  }
  if (!positiveFinite(recipe.servings)) errors.push('Serving count must be a positive finite number.');
  if (!recipe.ingredients.every((ingredient) => Boolean(ingredient?.householdMeasure?.trim?.()))) {
    warnings.push('One or more ingredients lack a household measure.');
  }
  const seenCodes = new Set();
  let hasCookingFat = false;

  recipe.ingredients.forEach((ingredient, index) => {
    const prefix = `Ingredient ${index + 1}`;
    const food = foodsByCode.get(ingredient?.ifctCode);
    if (!food) errors.push(`${prefix} references unknown IFCT code ${String(ingredient?.ifctCode ?? '(missing)')}.`);
    if (!positiveFinite(ingredient?.rawQuantityGrams)) errors.push(`${prefix} must have a positive raw quantity in grams.`);
    if (!positiveFinite(ingredient?.yieldFactor) || !positiveFinite(ingredient?.cookedWeightGrams)) {
      errors.push(`${prefix} must have valid yieldFactor and cookedWeightGrams values.`);
    } else if (positiveFinite(ingredient?.rawQuantityGrams)) {
      const expectedCooked = Math.round(Number(ingredient.rawQuantityGrams) * Number(ingredient.yieldFactor) * 10) / 10;
      if (Math.abs(expectedCooked - Number(ingredient.cookedWeightGrams)) > 0.1) {
        errors.push(`${prefix} cooked weight disagrees with raw quantity × yield factor.`);
      }
    }

    if (!ingredient?.unit) warnings.push(`${prefix} has no explicit unit field (the field name implies grams).`);
    if (!ingredient?.state) warnings.push(`${prefix} does not identify raw/cooked/dried/fresh/processed state.`);
    if (!positiveFinite(ingredient?.ediblePortionPercent)) warnings.push(`${prefix} has no verified edible-portion percentage.`);
    if (!ingredient?.quantitySource) warnings.push(`${prefix} has no source for its quantity.`);
    if (!ingredient?.yieldSource) warnings.push(`${prefix} has no source for its cooking yield.`);
    if (!ingredient?.foodSource || ingredient.foodSource !== 'IFCT 2017') {
      warnings.push(`${prefix} does not explicitly retain IFCT source provenance on the recipe ingredient.`);
    }

    if (food && isCookingFat(food)) hasCookingFat = true;
    if (ingredient?.ifctCode && seenCodes.has(ingredient.ifctCode)) {
      warnings.push(`IFCT code ${ingredient.ifctCode} occurs more than once; verify whether the entries should be combined or represent distinct preparation states.`);
    }
    if (ingredient?.ifctCode) seenCodes.add(ingredient.ifctCode);
  });

  if (!hasCookingFat) warnings.push('No cooking oil/ghee ingredient is recorded; do not assume added cooking fat is included in nutrition.');
  const nutrition = calculateRecipeNutrition(recipe, foods);
  if (!nutrition.available) errors.push('Calories or a primary macronutrient is missing from one or more IFCT records.');
  if (nutrition.macroEnergyDeviation !== null && nutrition.macroEnergyDeviation > 0.1) {
    errors.push('Macro-derived energy differs from IFCT calories by more than 10%.');
  }
  const readiness = errors.length ? 'blocked' : warnings.length ? 'usable_with_limitations' : 'ready';
  return {
    recipeId: recipe.recipeId ?? null,
    dishName: recipe.dishName ?? null,
    readiness,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    nutrition,
  };
}

/** Create a source/status summary and per-recipe audit without promoting data. */
export function auditRecipeCatalog(recipes = recipeTemplates, foods = getIfctFoods()) {
  const results = recipes.map((recipe) => auditRecipeProvenance(recipe, foods));
  const readinessCounts = results.reduce((totals, result) => {
    totals[result.readiness] += 1;
    return totals;
  }, { ready: 0, usable_with_limitations: 0, blocked: 0 });
  return {
    inspectedCount: results.length,
    ingredientCount: recipes.reduce((total, recipe) => total + (Array.isArray(recipe?.ingredients) ? recipe.ingredients.length : 0), 0),
    readinessCounts,
    recipes: results,
  };
}

export { recipeTemplates };
export default { auditRecipeCatalog, auditRecipeProvenance, calculateRecipeNutrition };
