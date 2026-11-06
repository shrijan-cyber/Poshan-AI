import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditRecipeCatalog,
  auditRecipeProvenance,
  calculateRecipeNutrition,
  recipeTemplates,
} from '../src/services/recipeQualityAudit.js';

const syntheticFood = (overrides = {}) => ({
  ifctCode: 'A001',
  foodName: 'Synthetic grain fixture',
  category: 'Cereals and Millets',
  nutrients: {
    calories: 350, protein: 8, carbs: 76, fat: 1,
    iron: 2, calcium: 4, vitaminD: null, vitaminB12: null, fiber: null,
  },
  ...overrides,
});
const syntheticRecipe = (overrides = {}) => ({
  recipeId: 'fixture-meal',
  dishName: 'Synthetic test meal',
  servings: 2,
  ingredients: [{
    ifctCode: 'A001', rawQuantityGrams: 100, yieldFactor: 2, cookedWeightGrams: 200,
    householdMeasure: '1 test portion',
  }],
  ...overrides,
});

test('recipe nutrition is recalculated from raw grams and reports whole recipe and per-serving totals', () => {
  const result = calculateRecipeNutrition(syntheticRecipe(), [syntheticFood()]);
  assert.equal(result.available, true);
  assert.deepEqual(result.wholeRecipe, {
    calories: 350, protein: 8, carbs: 76, fat: 1,
    iron: 2, calcium: 4, vitaminD: null, vitaminB12: null, fiber: null,
  });
  assert.equal(result.perServing.calories, 175);
  assert.equal(result.perServing.protein, 4);
  assert.equal(result.perServing.vitaminB12, null);
});

test('scaling a recipe by two doubles every known nutrient and preserves unknown nutrients', () => {
  const recipe = syntheticRecipe();
  const food = syntheticFood();
  const normal = calculateRecipeNutrition(recipe, [food]);
  const doubled = calculateRecipeNutrition(recipe, [food], 2);
  for (const key of ['calories', 'protein', 'carbs', 'fat', 'iron', 'calcium']) {
    assert.equal(doubled.wholeRecipe[key], normal.wholeRecipe[key] * 2);
    assert.equal(doubled.perServing[key], normal.perServing[key] * 2);
  }
  assert.equal(doubled.wholeRecipe.vitaminB12, null);
  assert.equal(doubled.perServing.vitaminB12, null);
});

test('invalid food references and inconsistent cooked-yield arithmetic block the recipe', () => {
  const missingFood = auditRecipeProvenance(syntheticRecipe(), []);
  assert.equal(missingFood.readiness, 'blocked');
  assert.equal(missingFood.nutrition.available, false);
  assert.ok(missingFood.errors.some((message) => /unknown IFCT code/i.test(message)));

  const badYield = syntheticRecipe({
    ingredients: [{ ...syntheticRecipe().ingredients[0], cookedWeightGrams: 250 }],
  });
  const result = auditRecipeProvenance(badYield, [syntheticFood()]);
  assert.equal(result.readiness, 'blocked');
  assert.ok(result.errors.some((message) => /cooked weight disagrees/i.test(message)));
});

test('macro-derived energy outside the ten-percent tolerance blocks recipe use', () => {
  const mismatchedFood = syntheticFood({ nutrients: {
    calories: 500, protein: 8, carbs: 76, fat: 1,
    iron: 2, calcium: 4, vitaminD: null, vitaminB12: null, fiber: null,
  } });
  const result = auditRecipeProvenance(syntheticRecipe(), [mismatchedFood]);
  assert.equal(result.readiness, 'blocked');
  assert.ok(result.errors.some((message) => /more than 10%/i.test(message)));
  assert.ok(result.nutrition.macroEnergyDeviation > 0.1);
});

test('missing measurement provenance and cooking fat are visible as limitations', () => {
  const result = auditRecipeProvenance(syntheticRecipe(), [syntheticFood()]);
  assert.equal(result.readiness, 'usable_with_limitations');
  assert.ok(result.warnings.some((message) => /explicit unit/i.test(message)));
  assert.ok(result.warnings.some((message) => /raw\/cooked/i.test(message)));
  assert.ok(result.warnings.some((message) => /edible-portion/i.test(message)));
  assert.ok(result.warnings.some((message) => /quantity/i.test(message)));
  assert.ok(result.warnings.some((message) => /cooking oil\/ghee/i.test(message)));
});

test('catalog audit inspects all current templates and reports readiness without changing them', () => {
  const before = JSON.stringify(recipeTemplates);
  const report = auditRecipeCatalog();
  assert.equal(report.inspectedCount, 20);
  assert.equal(report.ingredientCount, 70);
  assert.equal(report.readinessCounts.ready, 0);
  assert.equal(report.readinessCounts.usable_with_limitations + report.readinessCounts.blocked, 20);
  assert.equal(JSON.stringify(recipeTemplates), before);
  assert.ok(report.recipes.every(({ readiness, warnings }) => readiness !== 'ready' && warnings.length > 0));
});
