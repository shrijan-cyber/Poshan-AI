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
    }
    return Object.freeze({ ...value, ingredients: Object.freeze(value.ingredients.map((item) => Object.freeze(item))) });
  });

  return Object.freeze(catalog);
}

export const recipeCatalog = createValidatedCatalog();
export { createValidatedCatalog };
export default recipeCatalog;
