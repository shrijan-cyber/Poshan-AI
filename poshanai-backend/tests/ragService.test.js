import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMealPlanPrompt,
  getFoodByIfctCode,
  getMedicalDisclaimer,
  retrieveFoodsForDeficiencies,
} from '../src/rag/ragService.js';
import { getHouseholdFoodWhitelist, loadIfctDataset } from '../src/rag/ifctLoader.js';
import { hasSevereB12Deficiency, mealPlanSystemPrompt } from '../src/rag/promptBuilder.js';
import { buildStoredMeals } from '../src/services/aiService.js';

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
  assert.match(prompt, /"age":null/);
  assert.match(prompt, /"weight":null/);
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
  assert.match(prompt, /The user is deficient in Iron \(LOW, 8 µg\/dL\); Vitamin B12 \(LOW, 120 pg\/mL\)/);
  assert.match(prompt, /specifically target these deficiencies/);
  assert.match(prompt, /For every meal, explicitly name which nutrient it targets/);
  assert.match(prompt, /below 150 pg\/mL/);
  assert.match(prompt, /clinician-supervised vitamin B12 supplement/);
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

test('allows a user-requested otherwise uncommon IFCT food and keeps it out when rejected', () => {
  const requested = retrieveFoodsForDeficiencies([], { dietType: 'veg', householdDiet: 'I usually eat ragi with dal.' });
  const rejected = retrieveFoodsForDeficiencies([], { dietType: 'veg', householdDiet: 'I do not eat ragi.' });
  const requestedAmaranth = retrieveFoodsForDeficiencies([], { dietType: 'veg', householdDiet: 'Please include amaranth.' });
  const requestedBarley = retrieveFoodsForDeficiencies([], { dietType: 'veg', householdDiet: 'Please include barley.' });
  assert.ok(requested.some((food) => food.ifctCode === 'A010'));
  assert.ok(rejected.every((food) => food.ifctCode !== 'A010'));
  assert.ok(requestedAmaranth.some((food) => food.ifctCode === 'A001'));
  assert.ok(requestedBarley.every((food) => !/barley/i.test(food.foodName)));
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
  }], byCode, 'veg');

  const paneerItem = meal.items.find((item) => item.ifctCode === paneer.ifctCode);
  const riceItem = meal.items.find((item) => item.ifctCode === rice.ifctCode);
  assert.equal(meal.proteinSource, paneer.foodName);
  assert.equal(paneerItem.quantityGrams, 100);
  assert.equal(riceItem.nutrients.calories, rice.nutrients.calories);
  assert.equal(riceItem.nutrients.protein, rice.nutrients.protein);
  assert.equal(riceItem.nutrients.carbs, rice.nutrients.carbs);
  assert.equal(paneerItem.nutrients.calories, paneer.nutrients.calories);
});
