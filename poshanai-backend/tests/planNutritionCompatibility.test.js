import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDietPlanNutritionAvailability,
  addMealPlanNutritionAvailability,
  nutrientState,
} from '../src/services/planNutritionCompatibility.js';

const complete = { calories: 500, protein: 20, carbs: 60, fat: 15 };

describe('saved plan nutrition compatibility', () => {
  it('marks complete persisted daily and meal totals as stored without changing them', () => {
    const plan = {
      meals: [{ mealName: 'Lunch', ...complete, macros: { protein: 20, carbs: 60, fat: 15 } }],
      dailyNutrition: [{ day: 1, ...complete }],
    };
    const result = addDietPlanNutritionAvailability(plan);

    assert.equal(result.nutritionAvailability.status, 'stored');
    assert.equal(result.nutritionAvailability.daily, 'stored');
    assert.equal(result.meals[0].nutritionStatus, 'stored');
    assert.deepEqual(result.dailyNutrition, plan.dailyNutrition);
    assert.equal(result.nutritionAvailability.recalculation.status, 'not_needed');
  });

  it('marks a legacy plan with saved meal nutrition but no daily summary incomplete', () => {
    const result = addDietPlanNutritionAvailability({
      meals: [{ mealName: 'Lunch', calories: 500, macros: { protein: 20, carbs: 60, fat: 15 } }],
    });

    assert.equal(result.nutritionAvailability.status, 'incomplete');
    assert.equal(result.nutritionAvailability.daily, 'unavailable');
    assert.equal(result.meals[0].nutritionStatus, 'stored');
    assert.equal(result.nutritionAvailability.recalculation.status, 'unavailable');
    assert.match(result.nutritionAvailability.recalculation.reason, /provenance/i);
  });

  it('marks a daily summary incomplete when a saved day is missing', () => {
    const result = addDietPlanNutritionAvailability({
      meals: [
        { day: 1, calories: 300, macros: { protein: 10, carbs: 40, fat: 8 } },
        { day: 2, calories: 400, macros: { protein: 15, carbs: 50, fat: 12 } },
      ],
      dailyNutrition: [{ day: 1, calories: 300, protein: 10, carbs: 40, fat: 8 }],
    });

    assert.equal(result.nutritionAvailability.status, 'incomplete');
    assert.equal(result.nutritionAvailability.daily, 'incomplete');
  });

  it('marks partially persisted nutrition incomplete and never fills missing values', () => {
    const result = addMealPlanNutritionAvailability({
      meals: [{ day: 1, calories: 400, macros: { protein: 18, carbs: null, fat: 10 } }],
    });

    assert.equal(result.nutritionAvailability.status, 'incomplete');
    assert.equal(result.meals[0].nutritionStatus, 'incomplete');
    assert.equal(result.meals[0].macros.carbs, null);
    assert.equal(result.nutritionAvailability.recalculation.status, 'unavailable');
  });

  it('marks plans with no saved nutrition unavailable', () => {
    const result = addMealPlanNutritionAvailability({ meals: [{ day: 1, items: [] }] });
    assert.equal(result.nutritionAvailability.status, 'unavailable');
    assert.equal(result.meals[0].nutritionStatus, 'unavailable');
  });

  it('treats null and absent values as unavailable rather than zero', () => {
    assert.equal(nutrientState({ calories: 0, protein: 0, carbs: 0, fat: 0 }), 'stored');
    assert.equal(nutrientState({ calories: 0, protein: null, carbs: 0, fat: 0 }), 'incomplete');
    assert.equal(nutrientState({ calories: null, protein: null, carbs: null, fat: null }), 'unavailable');
  });
});
