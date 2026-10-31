import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateTestRules, testRules } from '../src/services/testRules.js';

test('no relevant answers produce no test suggestions', () => {
  assert.deepEqual(evaluateTestRules({
    symptoms: ['none'], dietType: 'veg', age: 25, familyHistory: [], sunExposure: 'moderate',
  }), []);
});

test('vegetarian user reporting fatigue gets a B12 discussion suggestion', () => {
  const matches = evaluateTestRules({
    symptoms: ['fatigue'], dietType: 'veg', age: 25, familyHistory: [], sunExposure: 'moderate',
  });
  assert.ok(matches.some(({ testName }) => testName === 'Vitamin B12'));
  assert.ok(matches.every(({ disclaimer }) => disclaimer));
});

test('age 40 or above with diabetes family history gets HbA1c suggestion', () => {
  const matches = evaluateTestRules({
    symptoms: ['none'], dietType: 'non-veg', age: 41, familyHistory: ['diabetes'], sunExposure: 'moderate',
  });
  assert.ok(matches.some(({ testName }) => testName === 'HbA1c'));
});

test('every matching rule returns rationale, triggering factors, and a disclaimer', () => {
  const matches = evaluateTestRules({
    symptoms: ['fatigue', 'hair fall', 'bone pain'],
    dietType: 'veg', age: 42, familyHistory: ['diabetes', 'thyroid disease'], sunExposure: 'low',
  });
  assert.ok(matches.length > 0);
  for (const recommendation of matches) {
    assert.ok(recommendation.rationale);
    assert.ok(Array.isArray(recommendation.triggeringFactors));
    assert.ok(recommendation.disclaimer);
  }
  assert.equal(matches.length, testRules.rules.length);
});
