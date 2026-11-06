import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateRuleSet,
  evaluateTestRules,
  getTestRuleCatalogStatus,
  testRules,
  validateTestRules,
} from '../src/services/testRules.js';

const profile = (overrides = {}) => ({
  dietType: 'non-veg',
  typicalDiet: ['rice', 'roti', 'dal', 'eggs', 'chicken'],
  sunExposure: 'moderate',
  symptoms: ['none'],
  habits: ['none'],
  sleepHours: 7,
  activityLevel: 'moderate',
  ...overrides,
});

test('rule catalog validates and exposes a medical disclaimer and meaningful routine message', () => {
  assert.equal(validateTestRules(testRules), testRules);
  assert.match(testRules.disclaimer, /qualified healthcare professional/i);
  assert.match(testRules.routineMessage, /routine check-ups/i);
});

test('vegan diet alone does not recommend a test; vegan diet with fatigue triggers B12 discussion', () => {
  const veganAlone = evaluateTestRules(profile({ dietType: 'vegan', typicalDiet: ['rice', 'dal'] }));
  const veganWithFatigue = evaluateTestRules(profile({ dietType: 'vegan', symptoms: ['fatigue'] }));
  const vegetarian = evaluateTestRules(profile({ dietType: 'veg', symptoms: ['fatigue'] }));
  assert.equal(veganAlone.some(({ testName }) => /B12/i.test(testName)), false);
  const b12 = veganWithFatigue.find(({ testName }) => /B12/i.test(testName));
  assert.ok(b12);
  assert.deepEqual(b12.triggeringFactors.map(({ field }) => field), ['dietType', 'symptoms']);
  assert.ok(b12.sources.some((source) => source.includes('nice.org.uk/guidance/ng239')));
  assert.equal(vegetarian.some(({ testName }) => /B12/i.test(testName)), false);
});

test('non-vegetarian profile without symptoms receives no specific test topic', () => {
  const results = evaluateTestRules(profile());
  assert.deepEqual(results, []);
});

test('low sunlight alone does not trigger a test; bone discomfort with low sunlight suggests discussion', () => {
  assert.deepEqual(evaluateTestRules(profile({ sunExposure: 'low' })), []);
  const results = evaluateTestRules(profile({ sunExposure: 'low', symptoms: ['bone pain'] }));
  assert.equal(results.length, 1);
  assert.match(results[0].testName, /Vitamin D/i);
  assert.deepEqual(results[0].triggeringFactors.map(({ field }) => field), ['sunExposure', 'symptoms']);
});

test('fatigue and hair fall suggest clinician evaluation topics without asserting a diagnosis', () => {
  const results = evaluateTestRules(profile({ symptoms: ['fatigue', 'hair fall'] }));
  assert.equal(results.length, 2);
  assert.ok(results.some(({ testName }) => /fatigue/i.test(testName)));
  assert.ok(results.some(({ testName }) => /hair fall/i.test(testName)));
  assert.ok(results.every(({ whatItMeasures, disclaimer }) => whatItMeasures && disclaimer));
});

test('multiple matching conditions return independent topics with answer factors', () => {
  const results = evaluateTestRules(profile({
    dietType: 'vegan', typicalDiet: ['rice', 'dal'], sunExposure: 'low',
    symptoms: ['fatigue', 'bone pain'],
  }));
  assert.equal(results.length, 3);
  assert.ok(results.every(({ rationale, triggeringFactors }) => rationale && triggeringFactors.length > 0));
});

test('missing optional profile fields are handled without throwing', () => {
  const results = evaluateTestRules({ symptoms: ['fatigue'] });
  assert.equal(results.length, 1);
  assert.equal(results[0].triggeringFactors[0].value[0], 'fatigue');
});

test('age, gender, habits, sleep and activity alone do not trigger tests', () => {
  const results = evaluateTestRules(profile({
    age: 80, gender: 'female', habits: ['smoking'], sleepHours: 2, activityLevel: 'sedentary',
  }));
  assert.deepEqual(results, []);
});

test('same test topic from multiple rules is consolidated', () => {
  const base = testRules.rules.find(({ ruleId }) => ruleId === 'rule_fatigue_clinical_evaluation_01');
  const duplicate = {
    ...structuredClone(base),
    ruleId: 'rule_fatigue_duplicate_01',
    rationale: 'A clinician can consider the duration and impact of the symptom.',
  };
  const results = evaluateRuleSet(profile({ symptoms: ['fatigue'] }), [base, duplicate], testRules.disclaimer);
  assert.equal(results.length, 1);
  assert.equal(results[0].ruleIds.length, 2);
  assert.match(results[0].rationale, /duration and impact/);
  assert.ok(results[0].sources.includes(base.sources[0]));
});

test('invalid rules and unsupported profile fields fail validation', () => {
  const invalidRule = structuredClone(testRules);
  invalidRule.rules[0].conditions[0].field = 'unknownHealthField';
  assert.throws(() => validateTestRules(invalidRule), /Invalid condition/);

  const invalidCatalog = structuredClone(testRules);
  invalidCatalog.unreviewedNote = 'not supported';
  assert.throws(() => validateTestRules(invalidCatalog), /versioned catalog/);

  const invalidEnumValue = structuredClone(testRules);
  invalidEnumValue.rules[0].conditions[0].value = 'strict-ish';
  assert.throws(() => validateTestRules(invalidEnumValue), /Condition value\/operator/);
});

test('routine response has no random suggestions', () => {
  const first = evaluateTestRules(profile());
  const second = evaluateTestRules(profile());
  assert.deepEqual(first, second);
  assert.deepEqual(first, []);
});

test('empty rules are reported as unavailable and never masquerade as a no-match profile', () => {
  const emptyCatalog = { ...structuredClone(testRules), rules: [] };
  assert.equal(getTestRuleCatalogStatus(emptyCatalog).status, 'empty');
  assert.equal(getTestRuleCatalogStatus(emptyCatalog).activeRuleCount, 0);
  assert.throws(() => evaluateTestRules(profile(), emptyCatalog), /no active rules/i);
});

test('each enabled rule has a traceable clinical source and clinician-directed wording', () => {
  for (const rule of testRules.rules) {
    assert.ok(rule.sources.length > 0, `${rule.ruleId} has no source`);
    assert.match(rule.rationale, /clinician|healthcare professional/i);
  }
});
