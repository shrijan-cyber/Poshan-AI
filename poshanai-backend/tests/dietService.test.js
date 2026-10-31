import assert from 'node:assert/strict';
import test from 'node:test';
import { getIfctFoods } from '../src/rag/ifctLoader.js';
import { buildGroceryList } from '../src/services/groceryService.js';
import {
  calculateIfctNutrition,
  composeRecipeMealPlan,
  generateBasicDietPlan,
  validateMacroEnergyConsistency,
} from '../src/services/dietService.js';
import { recipeCatalog } from '../src/services/recipeCatalog.js';
import { enhanceRecipeInstructions } from '../src/services/aiService.js';

const profile = (overrides = {}) => ({
  age: 35,
  gender: 'female',
  weightKg: 60,
  heightCm: 165,
  activityLevel: 'moderate',
  goal: 'maintain',
  dietType: 'veg',
  mealsPerDay: 3,
  allergies: [],
  dislikes: [],
  preferredFoods: [],
  ...overrides,
});

test('validates a catalog of 15–20 recipes and excludes foods outside the household whitelist', () => {
  assert.ok(recipeCatalog.length >= 15 && recipeCatalog.length <= 20);
  assert.equal(new Set(recipeCatalog.map(({ recipeId }) => recipeId)).size, recipeCatalog.length);
  assert.ok(recipeCatalog.every((recipe) => recipe.ingredients.length > 0));
  assert.ok(recipeCatalog.every((recipe) => recipe.ingredients.every(({ ifctCode }) => getIfctFoods().some((food) => food.ifctCode === ifctCode))));
});

test('selects only diet-compatible recipes for vegan and eggetarian users', () => {
  const veganPlan = generateBasicDietPlan(profile({ dietType: 'vegan' }));
  const eggetarianPlan = generateBasicDietPlan(profile({ dietType: 'eggetarian', allergies: ['eggs'] }));

  assert.ok(veganPlan.meals.every((meal) => meal.dietaryCompatibility.includes('Vegan')));
  assert.ok(veganPlan.meals.every((meal) => meal.items.every((item) => !['L003', 'M001', 'N003'].includes(item.ifctCode))));
  assert.ok(eggetarianPlan.meals.every((meal) => meal.items.every((item) => item.ifctCode !== 'M001')));
  assert.ok(eggetarianPlan.meals.every((meal) => !/egg/i.test(meal.dishName)));
});

test('dislike aliases exclude matching recipe ingredients', () => {
  const plan = generateBasicDietPlan(profile({ dislikes: ['onions'] }));
  assert.ok(plan.meals.every((meal) => meal.items.every((item) => item.ifctCode !== 'G017')));
});

test('portion scaling reaches calorie target and computes nutrients from raw IFCT weights', () => {
  const plan = generateBasicDietPlan(profile());
  const actualCalories = plan.meals.reduce((sum, meal) => sum + meal.calories, 0);
  assert.ok(actualCalories >= plan.targetCalories * 0.9);
  assert.ok(actualCalories <= plan.targetCalories * 1.1);
  assert.ok(plan.macroTargets.protein > 0 && plan.macroTargets.carbs > 0 && plan.macroTargets.fat > 0);

  const foodByCode = new Map(getIfctFoods().map((food) => [food.ifctCode, food]));
  for (const item of plan.meals.flatMap((meal) => meal.items)) {
    const expected = Math.round((foodByCode.get(item.ifctCode).nutrients.calories * item.rawIngredientWeight.quantityGrams / 100) * 100) / 100;
    assert.equal(item.nutrients.calories, expected);
    assert.equal(item.rawIngredientWeight.unit, 'g');
    assert.equal(item.rawWeightGrams, item.rawIngredientWeight.quantityGrams);
    assert.equal(item.cookedWeightGrams, Math.round(item.rawWeightGrams * item.yieldFactor * 10) / 10);
    assert.match(item.cookedServingDescription, /cooked/i);
  }
});

test('IFCT nutrition uses raw ingredient grams and preserves null values', () => {
  const foods = new Map(getIfctFoods().map((food) => [food.ifctCode, food]));
  const rice = foods.get('A015');
  const hundredGrams = calculateIfctNutrition(rice, 100);
  assert.equal(hundredGrams.calories, rice.nutrients.calories);
  assert.equal(hundredGrams.protein, rice.nutrients.protein);
  assert.equal(validateMacroEnergyConsistency(hundredGrams).valid, true);

  const twoHundredGrams = calculateIfctNutrition(rice, 200);
  for (const key of ['calories', 'protein', 'carbs', 'fat']) {
    assert.equal(twoHundredGrams[key], hundredGrams[key] * 2);
  }
  assert.equal(calculateIfctNutrition(foods.get('M001'), 100).vitaminB12, null);
});

test('seven-day recipe plans vary lunch and dinner combinations on consecutive days', () => {
  const plan = composeRecipeMealPlan(profile(), { days: 7 });
  assert.notEqual(plan.status, 'unachievable');
  for (let day = 2; day <= 7; day += 1) {
    const prior = plan.meals.filter((meal) => meal.day === day - 1 && ['lunch', 'dinner'].includes(meal.mealType));
    const current = plan.meals.filter((meal) => meal.day === day && ['lunch', 'dinner'].includes(meal.mealType));
    assert.notDeepEqual(current.map((meal) => meal.recipeId), prior.map((meal) => meal.recipeId));
  }
});

test('extreme calorie targets return unachievable instead of exceeding raw rice and dal caps', () => {
  const result = composeRecipeMealPlan(profile({
    age: 20,
    gender: 'male',
    weightKg: 200,
    heightCm: 250,
    activityLevel: 'active',
    goal: 'gain',
  }), { days: 7 });
  assert.equal(result.status, 'unachievable');
  assert.match(result.message, /safe raw ingredient portions/i);
  assert.deepEqual(result.meals, []);
});

test('very low calorie targets return unachievable instead of shrinking recipes below half portions', () => {
  const result = composeRecipeMealPlan(profile({
    age: 100,
    gender: 'female',
    weightKg: 30,
    heightCm: 120,
    activityLevel: 'sedentary',
  }));
  assert.equal(result.status, 'unachievable');
  assert.match(result.message, /too low/i);
  assert.deepEqual(result.meals, []);
});

test('macro reconciliation rejects energy discrepancies greater than ten percent', () => {
  assert.throws(
    () => validateMacroEnergyConsistency({ calories: 100, protein: 1, carbs: 1, fat: 1 }),
    (error) => error.code === 'NUTRITION_MACRO_RECONCILIATION_FAILED',
  );
});

test('grocery aggregation deduplicates identical raw ingredients across recipes', () => {
  const plan = composeRecipeMealPlan(profile(), { days: 1 });
  const expectedOnionGrams = plan.meals.flatMap((meal) => meal.ingredients)
    .filter((ingredient) => ingredient.ifctCode === 'G017')
    .reduce((sum, ingredient) => sum + ingredient.rawQuantityGrams, 0);
  assert.ok(expectedOnionGrams > 0);

  const groceryList = buildGroceryList(plan);
  const onions = groceryList.flatMap(({ items }) => items).filter(({ ifctCodes }) => ifctCodes.includes('G017'));
  assert.equal(onions.length, 1);
  assert.equal(onions[0].quantity, expectedOnionGrams);
  assert.equal(onions[0].unit, 'g');
});

test('grocery totals use rawWeightGrams and group on IFCT code plus canonical name', () => {
  const groceryList = buildGroceryList({ meals: [
    { ingredients: [{ ifctCode: 'G017', canonicalName: 'Pyaaz', quantity: 999, rawWeightGrams: 100, unit: 'g', state: 'raw' }] },
    { ingredients: [{ ifctCode: 'G017', canonicalName: 'Pyaaz', quantity: 999, rawWeightGrams: 50, unit: 'g', state: 'raw' }] },
  ] });
  const onion = groceryList.flatMap(({ items }) => items).find(({ ifctCodes }) => ifctCodes.includes('G017'));
  assert.equal(onion.quantity, 150);
});

test('AI failure falls back to static recipe cooking instructions', async () => {
  const plan = generateBasicDietPlan(profile());
  const selected = plan.meals[0];
  const expected = selected.cookingInstructions;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('simulated AI outage'); };
  try {
    const [enhanced] = await enhanceRecipeInstructions([selected]);
    assert.deepEqual(enhanced.cookingInstructions, expected);
    assert.deepEqual(enhanced.recipeInstructions, expected);
    assert.equal(enhanced.swapSuggestion, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
