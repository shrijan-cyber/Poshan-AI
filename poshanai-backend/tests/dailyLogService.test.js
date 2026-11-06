import assert from 'node:assert/strict';
import test from 'node:test';
import { compareMicronutrientsToRda, sumMicronutrients, summarizeMicronutrientsBySource } from '../src/services/dailyLogService.js';
import { MICRONUTRIENTS } from '../src/config/constants.js';

test('marks nutrients missing from IFCT as unavailable in daily-log RDA progress', () => {
  const totals = sumMicronutrients([{ micronutrients: {
    vitaminA: null,
    vitaminC: null,
    vitaminD: 120,
    vitaminE: null,
    vitaminK: null,
    vitaminB1: null,
    vitaminB2: null,
    vitaminB3: null,
    vitaminB6: null,
    vitaminB9: null,
    vitaminB12: null,
    iron: 4,
    calcium: 100,
    zinc: null,
    magnesium: null,
    potassium: null,
  } }]);
  const progress = compareMicronutrientsToRda(totals, { age: 30, gender: 'female' });

  assert.equal(progress.length, MICRONUTRIENTS.length);
  assert.equal(progress.find(({ key }) => key === 'iron').dataUnavailable, false);
  assert.equal(progress.find(({ key }) => key === 'vitaminD').dataUnavailable, false);
  assert.equal(progress.find(({ key }) => key === 'vitaminB12').dataUnavailable, true);
  assert.equal(progress.find(({ key }) => key === 'vitaminA').progressPercent, null);
});

test('reports IFCT gaps as unavailable even before a food is logged', () => {
  const progress = compareMicronutrientsToRda(sumMicronutrients(), { age: 30, gender: 'female' });
  assert.equal(progress.find(({ key }) => key === 'vitaminB12').dataUnavailable, true);
  assert.equal(progress.find(({ key }) => key === 'vitaminA').consumed, null);
  assert.equal(progress.find(({ key }) => key === 'iron').dataUnavailable, false);
});

test('keeps food, labeled supplement, and combined micronutrients separate without unsupported conversions', () => {
  const values = Object.fromEntries(MICRONUTRIENTS.map(({ key }) => [key, 0]));
  values.iron = 4;
  values.vitaminD = 80;
  values.vitaminB12 = null;
  const sources = summarizeMicronutrientsBySource(
    [{ micronutrients: values }],
    [{ components: [
      { nutrient: 'iron', consumedAmount: 2, unit: 'mg' },
      { nutrient: 'vitaminD', consumedAmount: 25, unit: 'µg' },
    ] }],
  );

  assert.equal(sources.food.iron, 4);
  assert.equal(sources.supplement.iron, 2);
  assert.equal(sources.combined.iron, 6);
  assert.equal(sources.supplement.vitaminD, null);
  assert.equal(sources.combined.vitaminD, null);
  assert.equal(sources.food.vitaminB12, null);
  assert.equal(sources.combined.vitaminB12, null);
});

test('reports zero logged supplement intake separately when there are no supplement entries', () => {
  const sources = summarizeMicronutrientsBySource();
  assert.equal(sources.supplement.iron, 0);
  assert.equal(sources.combined.iron, sources.food.iron);
});

test('does not coerce missing supplement nutrient values or malformed component amounts to zero', () => {
  const legacyTotals = sumMicronutrients([], [{
    supplementId: 'vitamin-d3', unit: 'IU', vitamins: { vitaminD: null },
  }]);
  assert.equal(legacyTotals.vitaminD, null);

  const sources = summarizeMicronutrientsBySource([], [{
    components: [{ nutrient: 'iron', consumedAmount: null, unit: 'mg' }],
  }]);
  assert.equal(sources.supplement.iron, null);
  assert.equal(sources.combined.iron, null);
});
