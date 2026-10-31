import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMealPlanPrompt,
  getFoodByIfctCode,
  getMedicalDisclaimer,
  resolveFoodReference,
  retrieveFoodsForDeficiencies,
} from '../src/rag/ragService.js';
import { getHouseholdFoodName, getHouseholdFoodWhitelist, loadIfctDataset } from '../src/rag/ifctLoader.js';
import { hasSevereB12Deficiency, mealPlanSystemPrompt } from '../src/rag/promptBuilder.js';
import { buildStoredMeals, validateGeneratedMealPlan } from '../src/services/aiService.js';
import { generateBasicDietPlan } from '../src/services/dietService.js';
import { foodMatchesAnyRestriction } from '../src/services/foodRestrictions.js';

test('provides IFCT records with serving size and preserves unreported vitamin B12 as null', () => {
  const foods = retrieveFoodsForDeficiencies([], { dietType: 'nonveg' });
  assert.ok(foods.length >= 20 && foods.length <= 30);
  assert.ok(foods.every((food) => food.servingSize === 100));
  assert.ok(foods.every((food) => food.nutrients.vitaminB12 === null));
  assert.ok(foods.some((food) => food.ifctCode && food.foodName));
});

test('marks the known IFCT cooking-oil energy gap as unavailable instead of zero', () => {
  const ghee = getFoodByIfctCode('T013');
  assert.equal(ghee.nutrients.calories, null);
  assert.equal(ghee.nutrients.fat, 100);
});

test('filters IFCT records by vegetarian diet, allergy, and Uttarakhand region', () => {
  const foods = retrieveFoodsForDeficiencies(
    [{ nutrient: 'Iron', severity: 'reported_low' }],
    { dietType: 'veg', allergies: ['legumes'], region: 'Uttarakhand' },
  );
  assert.ok(foods.length >= 20 && foods.length <= 30);
  assert.ok(foods.every((food) => food.category !== 'Grain Legumes' && food.ifctCode !== 'B023'));
});

test('builds a prompt from validated preferences and includes the required disclaimer provider', () => {
  const foods = retrieveFoodsForDeficiencies([], { dietType: 'veg' });
  const prompt = buildMealPlanPrompt({ dietType: 'veg' }, [], foods);
  assert.match(prompt, /Return only strict JSON/);
  assert.doesNotMatch(prompt, /"age"|"weight"/);
  assert.match(prompt, /Allowed IFCT foods/);
  assert.match(prompt, /"ifctCode"/);
  assert.match(prompt, /"foodName"/);
  assert.match(prompt, /Generate meals covering each day from 1 through 7/);
  assert.match(prompt, /nutrientTargets/);
  assert.match(mealPlanSystemPrompt, /Indian Household Nutrition Planner/i);
  assert.match(mealPlanSystemPrompt, /Do not replace the user's staple diet/i);
  assert.match(mealPlanSystemPrompt, /backend calculates them from IFCT values/i);
  assert.match(prompt, /cookingInstructions/);
  assert.match(prompt, /proteinSource/);
  assert.match(getMedicalDisclaimer(), /does not diagnose, treat, or replace advice/);
});

test('targets confirmed Iron and severe Vitamin B12 deficiencies without inventing IFCT values', () => {
  const deficiencies = [
    { nutrient: 'Iron', value: 8, unit: 'µg/dL', normalizedValue: 8, normalizedUnit: 'µg/dL', flag: 'low' },
    { nutrient: 'Vitamin B12', value: 120, unit: 'pg/mL', normalizedValue: 120, normalizedUnit: 'pg/mL', flag: 'low' },
  ];
  const foods = retrieveFoodsForDeficiencies(deficiencies, { dietType: 'veg' });
  const prompt = buildMealPlanPrompt({ dietType: 'veg' }, deficiencies, foods);

  assert.equal(hasSevereB12Deficiency(deficiencies), true);
  assert.match(prompt, /Iron: target intake 17 mg\/day/);
  assert.match(prompt, /Vitamin B12: target intake 2\.2 µg\/day/);
  assert.doesNotMatch(prompt, /8 µg\/dL|120 pg\/mL|SEVERE VITAMIN B12 DEFICIENCY/);
  assert.match(prompt, /For every meal, explicitly name which nutrient it targets/);
  assert.doesNotMatch(prompt, /clinician-supervised vitamin B12 supplement/);
  assert.doesNotMatch(prompt, /Reported deficiencies/);
  assert.match(prompt, /"nutrientTargets": \[/);
  assert.ok(foods.every((food) => food.nutrients.vitaminB12 === null));
});

test('returns familiar vegetarian foods for Vitamin D + Iron deficiency', () => {
  const foods = retrieveFoodsForDeficiencies(
    [{ nutrient: 'Vitamin D' }, { nutrient: 'Iron' }],
    { dietType: 'veg' },
  );

  // Retrieval ranks a short list only after limiting candidates to the household whitelist.
  assert.ok(foods.length >= 20 && foods.length <= 30);
  const whitelistCodes = new Set(getHouseholdFoodWhitelist(loadIfctDataset()).map(({ ifctCode }) => ifctCode));
  assert.ok(foods.every(({ ifctCode }) => whitelistCodes.has(ifctCode)));

  // Verify returned foods are all vegetarian
  const nonVegCategories = [
    'Egg and Egg Products',
    'Poultry',
    'Animal Meat',
    'Marine Fish',
    'Marine Shellfish',
    'Marine Mollusks',
    'Fresh Water Fish and Shellfish',
  ];
  for (const food of foods) {
    assert.ok(
      !nonVegCategories.includes(food.category),
      `Expected ${food.foodName} (${food.category}) to be vegetarian`,
    );
  }

  assert.ok(foods.some((food) => food.ifctCode === 'A011'), 'Poha should be available as a familiar staple');
  assert.ok(foods.some((food) => food.ifctCode === 'L003'), 'Paneer should be available as a vegetarian protein');
  assert.ok(foods.every((food) => !/\b(?:amaranth|agathi|ragi|quinoa|barley)\b/i.test(food.foodName)));
});

test('keeps household IFCT labels simple and sends only abstracted typical foods to the prompt', () => {
  const wheat = getFoodByIfctCode('A019');
  assert.equal(getHouseholdFoodName(wheat), 'Wheat Roti');

  const typicalDiet = '2 rotis, rice, dal, and sabzi';
  const foods = retrieveFoodsForDeficiencies([], { dietType: 'veg', householdDiet: typicalDiet });
  const prompt = buildMealPlanPrompt({ dietType: 'veg', householdDiet: typicalDiet }, [], foods);
  assert.doesNotMatch(prompt, /2 rotis, rice, dal, and sabzi/);
  assert.match(prompt, /recognized household food types/);
  assert.match(prompt, /Roti\/chapati/);
  assert.equal(getHouseholdFoodWhitelist(loadIfctDataset()).length, 100);
});

test('allows a user-requested otherwise uncommon IFCT food and keeps it out when rejected', () => {
  const requested = retrieveFoodsForDeficiencies([], { dietType: 'veg', householdDiet: 'I usually eat ragi with dal.' });
  const rejected = retrieveFoodsForDeficiencies([], { dietType: 'veg', householdDiet: 'I do not eat ragi.' });
  const requestedAmaranth = retrieveFoodsForDeficiencies([], { dietType: 'veg', householdDiet: 'Please include amaranth.' });
  const requestedBarley = retrieveFoodsForDeficiencies([], { dietType: 'veg', householdDiet: 'Please include barley.' });
  assert.ok(requested.some((food) => food.ifctCode === 'A010'));
  assert.ok(rejected.every((food) => food.ifctCode !== 'A010'));
  assert.ok(requestedAmaranth.some((food) => food.ifctCode === 'A001'));
  assert.ok(requestedBarley.some((food) => /barley/i.test(food.foodName)));
});

test('calculates macros from IFCT portions and adds paneer to a low-protein vegetarian meal', () => {
  const foods = retrieveFoodsForDeficiencies([], { dietType: 'veg' });
  const byCode = new Map(foods.map((food) => [food.ifctCode, food]));
  const rice = byCode.get('A015');
  const paneer = byCode.get('L003');
  assert.ok(rice && paneer);

  const [meal] = buildStoredMeals([{
    day: 1,
    mealType: 'lunch',
    nutrientTargets: ['Iron'],
    proteinSource: rice.foodName,
    cookingInstructions: 'Cook the rice until tender.',
    items: [{ ifctCode: rice.ifctCode, foodName: rice.foodName, quantityGrams: 100 }],
  }], byCode, 'veg', 25);

  const paneerItem = meal.items.find((item) => item.ifctCode === paneer.ifctCode);
  const riceItem = meal.items.find((item) => item.ifctCode === rice.ifctCode);
  assert.equal(meal.proteinSource, paneer.foodName);
  assert.equal(paneerItem.quantityGrams, Math.ceil(((25 - rice.nutrients.protein) * 100) / paneer.nutrients.protein));
  assert.equal(riceItem.foodName, 'Rice');
  assert.equal(paneerItem.foodName, 'Paneer');
  assert.equal(riceItem.nutrients.calories, rice.nutrients.calories);
  assert.equal(riceItem.nutrients.protein, rice.nutrients.protein);
  assert.equal(riceItem.nutrients.carbs, rice.nutrients.carbs);
  assert.equal(paneerItem.nutrients.calories, Math.round(paneer.nutrients.calories * (paneerItem.quantityGrams / 100) * 100) / 100);
  assert.ok(riceItem.nutrients.protein + paneerItem.nutrients.protein >= 25);
  assert.equal(riceItem.weightBasis, 'raw');
  assert.equal(riceItem.householdMeasure, null);
});

test('basic diet plan selections remain inside the household IFCT whitelist', () => {
  const plan = generateBasicDietPlan({
    age: 30,
    gender: 'female',
    weightKg: 60,
    heightCm: 165,
    activityLevel: 'moderate',
    goal: 'maintain',
    dietType: 'veg',
    mealsPerDay: 3,
    dislikes: [],
    allergies: [],
  });
  const whitelist = new Set(getHouseholdFoodWhitelist(loadIfctDataset()).map(({ ifctCode }) => ifctCode));
  const items = plan.meals.flatMap((meal) => meal.items);
  assert.ok(items.length > 0);
  assert.ok(items.every(({ ifctCode }) => whitelist.has(ifctCode)));
  assert.ok(items.every(({ foodName }) => !/\b(?:amaranth|agathi|ragi|quinoa|barley)\b/i.test(foodName)));
  assert.ok(plan.meals.every((meal) => meal.cookedHouseholdMeasure === null
    && meal.items.every((item) => item.rawIngredientWeight.quantityGrams === item.quantity
      && item.rawIngredientWeight.unit === 'g')));
});

test('food restriction aliases match plural eggs, dairy, and chickpeas', () => {
  assert.equal(foodMatchesAnyRestriction(['eggs'], { foodName: 'Egg, poultry, whole, raw', category: 'Egg and Egg Products' }), true);
  assert.equal(foodMatchesAnyRestriction(['milk'], { foodName: 'Paneer', category: 'Milk and Milk Products' }), true);
  assert.equal(foodMatchesAnyRestriction(['chickpeas'], { foodName: 'Bengal gram, whole', category: 'Grain Legumes' }), true);
});

test('missing IFCT food references resolve to labeled substitutes or null, never invented values', () => {
  const dahi = resolveFoodReference('dahi');
  assert.equal(dahi.substituted, true);
  assert.equal(dahi.food.foodName, 'Milk, whole, Cow');
  assert.match(dahi.warning, /No IFCT record for dahi/);

  const oats = resolveFoodReference('oats');
  assert.equal(oats.food, null);
  assert.match(oats.warning, /nutrient values were not estimated/);
});

test('post-generation validator rejects missing meals, oversized portions, and impossible calories', () => {
  const nutrientValues = { calories: 420, protein: 7.9, carbs: 78, fat: 0.5 };
  const validMeals = Array.from({ length: 7 }, (_, index) => ['breakfast', 'lunch', 'dinner'].map((mealType) => ({
    day: index + 1,
    mealType,
    items: [{ quantityGrams: 100, nutrients: nutrientValues }],
  }))).flat();
  assert.equal(validateGeneratedMealPlan(validMeals), true);
  assert.throws(() => validateGeneratedMealPlan(validMeals.filter((meal) => meal.mealType === 'breakfast')),
    (error) => error.code === 'MEAL_PLAN_INCOMPLETE');

  const oversized = validMeals.map((meal) => ({ ...meal, items: [{ quantityGrams: 1001, nutrients: nutrientValues }] }));
  assert.throws(() => validateGeneratedMealPlan(oversized), (error) => error.code === 'MEAL_PORTION_TOO_LARGE');

  const tooFewCalories = validMeals.map((meal) => ({ ...meal, items: [{
    quantityGrams: 10,
    nutrients: { ...nutrientValues, calories: 10 },
  }] }));
  assert.throws(() => validateGeneratedMealPlan(tooFewCalories), (error) => error.code === 'MEAL_PLAN_CALORIES_UNREALISTIC');

  const tooManyCalories = validMeals.map((meal) => ({ ...meal, items: [{
    quantityGrams: 1000,
    nutrients: { ...nutrientValues, calories: 200 },
  }] }));
  assert.throws(() => validateGeneratedMealPlan(tooManyCalories), (error) => error.code === 'MEAL_PLAN_CALORIES_UNREALISTIC');
});
