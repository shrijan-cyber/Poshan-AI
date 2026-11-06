import assert from 'node:assert/strict';
import test from 'node:test';
import { getHouseholdFoodName, getIfctFoods } from '../src/rag/ifctLoader.js';
import { buildGroceryList } from '../src/services/groceryService.js';
import {
  calculateIfctNutrition,
  calculateTargetCalories,
  composeRecipeMealPlan,
  generateBasicDietPlan,
  getPrimaryProteinSource,
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
  const eggetarianPlan = generateBasicDietPlan(profile({
    dietType: 'eggetarian', allergies: ['eggs'], preferredFoods: ['eggs'],
  }));

  assert.ok(veganPlan.meals.every((meal) => meal.dietaryCompatibility.includes('Vegan')));
  assert.ok(veganPlan.meals.every((meal) => meal.items.every((item) => !['L003', 'M001', 'N003'].includes(item.ifctCode))));
  assert.ok(eggetarianPlan.meals.every((meal) => meal.items.every((item) => item.ifctCode !== 'M001')));
  assert.ok(eggetarianPlan.meals.every((meal) => !/egg/i.test(meal.dishName)));
});

test('dislike aliases exclude matching recipe ingredients', () => {
  const plan = generateBasicDietPlan(profile({ dislikes: ['onions'] }));
  assert.ok(plan.meals.every((meal) => meal.items.every((item) => item.ifctCode !== 'G017')));
});

test('prioritizes familiar foods when the recipe can still cover a reasonable calorie share', () => {
  const plan = generateBasicDietPlan(profile({ typicalDiet: 'Rajma and rice are regular foods for me.' }));
  const lunch = plan.meals.find((meal) => meal.mealType === 'lunch');

  assert.equal(lunch.recipeId, 'rajma-chawal');
  assert.ok(plan.meals.reduce((sum, meal) => sum + meal.calories, 0) >= plan.targetCalories * 0.9);
});

test('portion scaling reaches calorie target and computes nutrients from raw IFCT weights', () => {
  const plan = generateBasicDietPlan(profile());
  const actualCalories = plan.meals.reduce((sum, meal) => sum + meal.calories, 0);
  assert.ok(actualCalories >= plan.targetCalories * 0.9);
  assert.ok(actualCalories <= plan.targetCalories * 1.1);
  assert.ok(plan.macroTargets.protein > 0 && plan.macroTargets.carbs > 0 && plan.macroTargets.fat > 0);
  assert.ok(['Breakfast', 'Lunch', 'Dinner'].every((category) => plan.meals.some((meal) => meal.mealCategory === category)));
  assert.match(plan.disclaimer, /not independently source-verified/i);

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

test('validates demographic, activity, goal, calorie and macro target inputs', () => {
  assert.throws(() => calculateTargetCalories(profile({ gender: 'unknown' })), (error) => error.code === 'INVALID_GENDER');
  assert.throws(() => calculateTargetCalories(profile({ goal: 'crash-diet' })), (error) => error.code === 'INVALID_GOAL');
  assert.throws(() => calculateTargetCalories(profile({ weightKg: 500 })), (error) => error.code === 'PROFILE_OUT_OF_RANGE');
  const plan = generateBasicDietPlan(profile());
  const targetEnergy = (plan.macroTargets.protein * 4)
    + (plan.macroTargets.carbs * 4)
    + (plan.macroTargets.fat * 9);
  assert.ok(Math.abs(targetEnergy - plan.targetCalories) / plan.targetCalories <= 0.01);
});

test('covers breakfast, lunch, snack and dinner when the user selects four meals', () => {
  const plan = generateBasicDietPlan(profile({ mealsPerDay: 4 }));
  assert.equal(plan.meals.length, 4);
  assert.deepEqual(new Set(plan.meals.map((meal) => meal.mealCategory)), new Set(['Breakfast', 'Lunch', 'Snack', 'Dinner']));
  assert.ok(plan.meals.filter((meal) => meal.primaryProteinSource === 'Paneer').length <= 1);
  assert.ok(plan.meals.every((meal) => meal.items.every((item) => !['M001', 'M004', 'N003'].includes(item.ifctCode))));
  assert.ok(new Set(plan.meals.map((meal) => meal.primaryProteinSourceGroup).filter(Boolean)).size >= 2);
  if (plan.diversityWarnings.length) assert.ok(plan.diversityWarnings.every((warning) => /repeats a primary protein source/i.test(warning)));
});

test('supports 2 through 6 meal schedules without repeating recipes to fill slots', () => {
  for (const mealsPerDay of [2, 3, 4, 5, 6]) {
    const plan = generateBasicDietPlan(profile({ mealsPerDay }));
    if (plan.status === 'unachievable') {
      assert.ok([2, 6].includes(mealsPerDay), `${mealsPerDay} meals unexpectedly unavailable: ${plan.message}`);
      continue;
    }
    assert.equal(plan.meals.length, mealsPerDay);
    assert.equal(new Set(plan.meals.map(({ recipeId }) => recipeId)).size, mealsPerDay);
    assert.ok(plan.meals.every(({ scheduleLabel, timing }) => scheduleLabel && (timing === null || /^\d{2}:\d{2}$/.test(timing))));
  }
});

test('custom meal names and timings are preserved and schedule count is validated', () => {
  const mealSchedule = [
    { name: 'Late breakfast', category: 'Breakfast', time: '10:00' },
    { name: 'Lunch break', category: 'Lunch', time: '14:00' },
    { name: 'Supper', category: 'Dinner', time: '20:00' },
  ];
  const plan = generateBasicDietPlan(profile({ mealsPerDay: 3, mealSchedule }));
  assert.notEqual(plan.status, 'unachievable');
  assert.deepEqual(plan.meals.map(({ scheduleLabel, timing }) => [scheduleLabel, timing]), mealSchedule.map(({ name, time }) => [name, time]));
  assert.throws(() => generateBasicDietPlan(profile({ mealsPerDay: 3, mealSchedule: mealSchedule.slice(0, 2) })),
    (error) => error.code === 'INVALID_MEAL_SCHEDULE');
});

test('recognizes different paneer recipes as the same primary protein source', () => {
  const foods = getIfctFoods();
  const paneerRecipes = recipeCatalog.filter(({ recipeId }) => ['paneer-bhurji-roti', 'palak-paneer-roti', 'gobhi-paneer-roti'].includes(recipeId));
  assert.equal(paneerRecipes.length, 3);
  const sources = paneerRecipes.map((recipe) => getPrimaryProteinSource(recipe, foods));
  assert.deepEqual(new Set(sources.map((source) => source?.group)), new Set(['dairy']));
  assert.ok(sources.every((source) => source?.label === 'Paneer'));
});

test('protein-source labels only appear when a verified ingredient contributes materially', () => {
  const plan = generateBasicDietPlan(profile());
  for (const meal of plan.meals) {
    if (meal.primaryProteinSource) {
      assert.ok(meal.ingredients.some((ingredient) => ingredient.canonicalName === meal.primaryProteinSource));
      assert.ok(meal.macros.protein > 0);
    }
  }
});

test('returns an unachievable result when restrictions leave a required meal category empty', () => {
  const foodsByCode = new Map(getIfctFoods().map((food) => [food.ifctCode, food]));
  const everyCatalogFood = [...new Set(recipeCatalog.flatMap((recipe) => recipe.ingredients.map(({ ifctCode }) => {
    const food = foodsByCode.get(ifctCode);
    return [food.foodName, getHouseholdFoodName(food)];
  }).flat()))];
  const result = composeRecipeMealPlan(profile({ allergies: everyCatalogFood }));
  assert.equal(result.status, 'unachievable');
  assert.match(result.message, /no safe recipe set covers every requested meal category/i);
  assert.deepEqual(result.meals, []);
});

test('rejects malformed allergy and dislike values instead of silently ignoring restrictions', () => {
  assert.throws(
    () => composeRecipeMealPlan(profile({ allergies: 'peanuts' })),
    (error) => error.code === 'INVALID_FOOD_RESTRICTIONS',
  );
  assert.throws(
    () => composeRecipeMealPlan(profile({ dislikes: [''] })),
    (error) => error.code === 'INVALID_FOOD_RESTRICTIONS',
  );
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
  assert.equal(onions[0].quantity, Math.round(expectedOnionGrams * 10) / 10);
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

test('rejects AI instructions that add oil, spices, salt, or vegetables outside the selected ingredients', async () => {
  const selected = generateBasicDietPlan(profile()).meals.find((meal) => !meal.ingredients.some(({ canonicalName }) => /oil|spinach|palak/i.test(canonicalName)));
  const originalFetch = globalThis.fetch;
  let sentRequest;
  let sentUrl;
  globalThis.fetch = async (url, options) => {
    sentUrl = url;
    sentRequest = JSON.parse(options.body);
    const recipe = { mealIndex: 0, recipeId: selected.recipeId, cookingInstructions: ['Add oil, salt, spices, spinach and water before cooking the ingredients.'], swapSuggestion: null };
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ recipes: [recipe] }) } }] }) };
  };
  try {
    const [enhanced] = await enhanceRecipeInstructions([selected]);
    assert.ok(!enhanced.cookingInstructions.some((step) => /\b(oil|spices|salt|spinach|water)\b/i.test(step)));
    assert.equal(enhanced.swapSuggestion, null);
    assert.match(sentUrl, /\/v1\/chat\/completions$/);
    assert.equal(sentRequest.model, process.env.OMNIROUTE_MODEL || 'gemini-2.0-flash');
    assert.match(sentRequest.messages[1].content, new RegExp(selected.recipeId));
    assert.match(sentRequest.messages[1].content, /"quantity"\s*:/);
    assert.doesNotMatch(sentRequest.messages[1].content, /staticInstructions/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
