import { createRequire } from 'node:module';
import { getHouseholdFoodWhitelist, getIfctFoods } from '../rag/ifctLoader.js';
import recipeSchema from '../schemas/recipeSchema.js';

const require = createRequire(import.meta.url);
const recipeTemplates = require('../data/recipes.json');

function createValidatedCatalog(templates = recipeTemplates, foods = getIfctFoods()) {
  if (!Array.isArray(templates) || templates.length < 15 || templates.length > 20) {
    throw new Error('Recipe catalog must contain 15 to 20 templates.');
  }

  const householdCodes = new Set(getHouseholdFoodWhitelist(foods).map(({ ifctCode }) => ifctCode));
  const foodsByCode = new Map(foods.map((food) => [food.ifctCode, food]));
  const seenIds = new Set();
  const catalog = templates.map((template) => {
    const { error, value } = recipeSchema.validate(template, { abortEarly: false, convert: true });
    if (error) throw new Error(`Invalid recipe template ${template?.recipeId ?? '(unknown)'}: ${error.message}`);
    if (seenIds.has(value.recipeId)) throw new Error(`Duplicate recipeId: ${value.recipeId}`);
    seenIds.add(value.recipeId);

    for (const ingredient of value.ingredients) {
      const expectedCookedGrams = Math.round(ingredient.rawQuantityGrams * ingredient.yieldFactor * 10) / 10;
      if (Math.abs(expectedCookedGrams - ingredient.cookedWeightGrams) > 0.1) {
        throw new Error(`Recipe ${value.recipeId} has inconsistent cooked yield for ${ingredient.ifctCode}.`);
      }
      const food = foodsByCode.get(ingredient.ifctCode);
      if (!food) throw new Error(`Unknown IFCT food ${ingredient.ifctCode} in recipe ${value.recipeId}.`);
      if (!householdCodes.has(ingredient.ifctCode)) {
        throw new Error(`Recipe ${value.recipeId} contains non-household food ${ingredient.ifctCode}.`);
      }
      for (const nutrient of ['calories', 'protein', 'carbs', 'fat']) {
        if (!Number.isFinite(food.nutrients?.[nutrient])) {
          throw new Error(`Recipe ${value.recipeId} uses ${ingredient.ifctCode} without IFCT ${nutrient} data.`);
        }
      }
      if (food.nutrients.calories === 0 && food.nutrients.fat > 0) {
        throw new Error(`Recipe ${value.recipeId} uses ${ingredient.ifctCode} with unresolved zero-energy and positive-fat data.`);
      }
    }
    const recipeNutrition = value.ingredients.reduce((totals, ingredient) => {
      const nutrients = foodsByCode.get(ingredient.ifctCode).nutrients;
      for (const key of ['calories', 'protein', 'carbs', 'fat']) {
        totals[key] += (nutrients[key] * ingredient.rawQuantityGrams) / 100;
      }
      return totals;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    const macroCalories = (recipeNutrition.protein * 4) + (recipeNutrition.carbs * 4) + (recipeNutrition.fat * 9);
    if (Math.abs(macroCalories - recipeNutrition.calories) / recipeNutrition.calories > 0.1) {
      throw new Error(`Recipe ${value.recipeId} IFCT macros do not reconcile to calories within 10%.`);
    }
    return Object.freeze({ ...value, ingredients: Object.freeze(value.ingredients.map((item) => Object.freeze(item))) });
  });

  return Object.freeze(catalog);
}

export const recipeCatalog = createValidatedCatalog();
export { createValidatedCatalog };
export default recipeCatalog;
