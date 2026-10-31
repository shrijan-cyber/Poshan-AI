import { readFileSync } from 'node:fs';
import { logger } from '../utils/logger.js';

const RULES_PATH = new URL('../../data/testRules.json', import.meta.url);
const DISCLAIMER = 'This is not a diagnosis or medical advice. Discuss whether any test is appropriate with a qualified doctor.';
const ALLOWED_FIELDS = new Set(['dietType', 'symptoms', 'age', 'familyHistory', 'sunExposure']);
const ALLOWED_OPERATORS = new Set(['equals', 'includes', 'oneOf', 'greaterThanOrEqual']);
const ALLOWED_CATEGORIES = new Set(['Screening', 'Symptom-based', 'Nutritional discussion']);

export function validateTestRules(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)
    || document.version !== 1 || typeof document.disclaimer !== 'string' || !Array.isArray(document.rules)) {
    throw new Error('testRules.json must contain version, disclaimer, and rules.');
  }
  if (Object.keys(document).some((key) => !['version', 'disclaimer', 'rules'].includes(key))) {
    throw new Error('testRules.json contains an unsupported top-level field.');
  }

  const ids = new Set();
  for (const rule of document.rules) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)
      || typeof rule.ruleId !== 'string' || !/^rule_[a-z0-9_]+$/.test(rule.ruleId)
      || ids.has(rule.ruleId)
      || typeof rule.testName !== 'string' || !rule.testName.trim()
      || !ALLOWED_CATEGORIES.has(rule.category)
      || typeof rule.rationale !== 'string' || !rule.rationale.trim()
      || !Array.isArray(rule.conditions) || rule.conditions.length === 0
      || Object.keys(rule).some((key) => !['ruleId', 'testName', 'category', 'conditions', 'rationale'].includes(key))) {
      throw new Error('Each test rule must have a unique ID, test, category, conditions, and rationale.');
    }
    ids.add(rule.ruleId);
    for (const condition of rule.conditions) {
      const validValue = condition?.operator === 'greaterThanOrEqual'
        ? Number.isFinite(condition.value)
        : condition?.operator === 'oneOf'
          ? Array.isArray(condition.value) && condition.value.length > 0
          : typeof condition?.value === 'string' && condition.value.length > 0;
      if (!condition || !ALLOWED_FIELDS.has(condition.field) || !ALLOWED_OPERATORS.has(condition.operator)
        || !Object.hasOwn(condition, 'value') || !validValue
        || Object.keys(condition).some((key) => !['field', 'operator', 'value'].includes(key))) {
        throw new Error(`Invalid condition in ${rule.ruleId}.`);
      }
    }
  }
  return document;
}

function conditionMatches(profile, condition) {
  const actual = profile?.[condition.field];
  switch (condition.operator) {
    case 'equals': return actual === condition.value;
    case 'includes': return Array.isArray(actual) && actual.includes(condition.value);
    case 'oneOf': return Array.isArray(condition.value) && condition.value.includes(actual);
    case 'greaterThanOrEqual': return typeof actual === 'number' && actual >= condition.value;
    default: return false;
  }
}

function describeFactor({ field, value }) {
  const labels = {
    dietType: 'Diet preference', symptoms: 'Reported symptom', age: 'Age',
    familyHistory: 'Family history', sunExposure: 'Sun exposure',
  };
  return { field, value, label: `${labels[field]}: ${Array.isArray(value) ? value.join(', ') : value}` };
}

export function evaluateTestRules(profile = {}, rules = testRules.rules) {
  return rules.filter((rule) => rule.conditions.every((condition) => conditionMatches(profile, condition)))
    .map((rule) => {
      const triggeringFactors = rule.conditions.map((condition) => describeFactor({
        field: condition.field,
        value: profile[condition.field],
      }));
      // Only the static catalog ID is allowed into operational logs; no answers or profile values.
      logger.info('Lifestyle test rule triggered.', { ruleId: rule.ruleId });
      return {
        ruleId: rule.ruleId,
        testName: rule.testName,
        category: rule.category,
        rationale: rule.rationale,
        reason: rule.rationale,
        triggeringFactors,
        disclaimer: DISCLAIMER,
      };
    });
}

export const testRules = validateTestRules(JSON.parse(readFileSync(RULES_PATH, 'utf8')));
export { DISCLAIMER };
