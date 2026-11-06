import { readFileSync } from 'node:fs';
import { logger } from '../utils/logger.js';

const RULES_PATH = new URL('../../data/testRules.json', import.meta.url);
const ALLOWED_FIELDS = new Set([
  'age', 'gender', 'dietType', 'typicalDiet', 'sunExposure', 'symptoms',
  'habits', 'sleepHours', 'activityLevel',
]);
const ENUM_FIELDS = new Set(['gender', 'dietType', 'sunExposure', 'activityLevel']);
const ARRAY_FIELDS = new Set(['typicalDiet', 'symptoms', 'habits']);
const NUMERIC_FIELDS = new Set(['age', 'sleepHours']);
const ALLOWED_OPERATORS = new Set(['equals', 'includes', 'oneOf', 'noneOf', 'greaterThanOrEqual']);
const ALLOWED_CATEGORIES = new Set([
  'Lifestyle risk and symptom discussion',
  'Reported symptom discussion',
  'Confirmed laboratory result',
]);
const EVIDENCE_TYPE_BY_FIELD = {
  age: 'lifestyle_context',
  gender: 'lifestyle_context',
  dietType: 'lifestyle_risk_indicator',
  typicalDiet: 'lifestyle_risk_indicator',
  sunExposure: 'lifestyle_risk_indicator',
  symptoms: 'reported_symptom',
  habits: 'lifestyle_context',
  sleepHours: 'lifestyle_context',
  activityLevel: 'lifestyle_context',
};
const ALLOWED_RULE_KEYS = new Set([
  'ruleId', 'testName', 'category', 'whatItMeasures', 'rationale', 'sources', 'conditions', 'triggerFields',
]);
const FIELD_LABELS = {
  age: 'Age', gender: 'Gender', dietType: 'Diet preference', typicalDiet: 'Typical diet',
  sunExposure: 'Sun exposure', symptoms: 'Reported symptom', habits: 'Reported habit',
  sleepHours: 'Sleep hours', activityLevel: 'Activity level',
};
const FIELD_VALUES = {
  gender: new Set(['male', 'female', 'other']),
  dietType: new Set(['veg', 'non-veg', 'eggetarian', 'vegan']),
  sunExposure: new Set(['high', 'moderate', 'low']),
  activityLevel: new Set(['sedentary', 'moderate', 'active']),
  symptoms: new Set(['fatigue', 'hair fall', 'bone pain', 'none']),
  habits: new Set(['smoking', 'alcohol', 'none']),
};

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateCondition(condition, ruleId) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)
    || !ALLOWED_FIELDS.has(condition.field) || !ALLOWED_OPERATORS.has(condition.operator)
    || !Object.hasOwn(condition, 'value')
    || Object.keys(condition).some((key) => !['field', 'operator', 'value'].includes(key))) {
    throw new Error(`Invalid condition in ${ruleId}.`);
  }

  const { field, operator, value } = condition;
  const valid = operator === 'greaterThanOrEqual'
    ? NUMERIC_FIELDS.has(field) && Number.isFinite(value)
    : operator === 'includes'
      ? ARRAY_FIELDS.has(field) && isNonEmptyString(value)
      : operator === 'noneOf'
        ? ARRAY_FIELDS.has(field) && Array.isArray(value) && value.length > 0 && value.every((item) => (
          isNonEmptyString(item) && (!FIELD_VALUES[field] || FIELD_VALUES[field].has(item))
        ))
        : operator === 'oneOf'
          ? ENUM_FIELDS.has(field) && Array.isArray(value)
            && value.length > 0 && value.every((item) => FIELD_VALUES[field].has(item))
          : ENUM_FIELDS.has(field) && isNonEmptyString(value) && FIELD_VALUES[field].has(value);

  if (!valid) throw new Error(`Condition value/operator does not match ${field} in ${ruleId}.`);
}

export function validateTestRules(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)
    || document.version !== 4
    || !isNonEmptyString(document.catalogVersion)
    || !isNonEmptyString(document.disclaimer)
    || !isNonEmptyString(document.routineMessage)
    || !Array.isArray(document.rules)
    || Object.keys(document).some((key) => !['version', 'catalogVersion', 'disclaimer', 'routineMessage', 'rules'].includes(key))) {
    throw new Error('testRules.json must contain a versioned catalog, disclaimer, routine message, and rules.');
  }

  const ids = new Set();
  for (const rule of document.rules) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)
      || !isNonEmptyString(rule.ruleId) || !/^rule_[a-z0-9_]+$/.test(rule.ruleId) || ids.has(rule.ruleId)
      || !isNonEmptyString(rule.testName) || !ALLOWED_CATEGORIES.has(rule.category)
      || !isNonEmptyString(rule.whatItMeasures) || !isNonEmptyString(rule.rationale)
      || !Array.isArray(rule.sources) || rule.sources.length === 0
      || rule.sources.some((source) => {
        try { return new URL(source).protocol !== 'https:'; } catch { return true; }
      })
      || !Array.isArray(rule.conditions) || rule.conditions.length === 0
      || !Array.isArray(rule.triggerFields) || rule.triggerFields.length === 0
      || rule.triggerFields.some((field) => !ALLOWED_FIELDS.has(field))
      || Object.keys(rule).some((key) => !ALLOWED_RULE_KEYS.has(key))) {
      throw new Error('Each recommendation rule must have a unique ID, topic, category, details, conditions, and trigger fields.');
    }
    rule.conditions.forEach((condition) => validateCondition(condition, rule.ruleId));
    const availableTriggerFields = new Set(rule.conditions
      .filter(({ operator }) => operator !== 'noneOf')
      .map(({ field }) => field));
    if (rule.triggerFields.some((field) => !availableTriggerFields.has(field))) {
      throw new Error(`Trigger fields must identify positive conditions in ${rule.ruleId}.`);
    }
    ids.add(rule.ruleId);
  }
  return document;
}

function conditionMatches(profile, { field, operator, value }) {
  const actual = profile?.[field];
  switch (operator) {
    case 'equals': return actual === value;
    case 'includes': return Array.isArray(actual) && actual.includes(value);
    case 'oneOf': return Array.isArray(value) && value.includes(actual);
    case 'noneOf': return actual === undefined || actual === null || (Array.isArray(actual) && value.every((item) => !actual.includes(item)));
    case 'greaterThanOrEqual': return typeof actual === 'number' && actual >= value;
    default: return false;
  }
}

function triggeringFactor(field, profile) {
  const value = profile[field];
  const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
  return {
    field,
    evidenceType: EVIDENCE_TYPE_BY_FIELD[field],
    value,
    label: `${FIELD_LABELS[field]}: ${displayValue}`,
  };
}

/** Pure matching layer; this data-only engine never diagnoses or chooses treatment. */
export function evaluateRuleSet(profile = {}, rules = [], disclaimer = testRules.disclaimer) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new TypeError('A saved lifestyle profile object is required to evaluate test rules.');
  }
  const matchedRules = rules.filter((rule) => rule.conditions.every((condition) => conditionMatches(profile, condition)));
  const recommendationsByKey = new Map();

  for (const rule of matchedRules) {
    // Log only a static rule identifier, never the user's profile or answers.
    logger.info('Lifestyle recommendation rule triggered.', { ruleId: rule.ruleId });
    const factors = rule.triggerFields.map((field) => triggeringFactor(field, profile));
    const key = rule.testName.trim().toLocaleLowerCase('en');
    const existing = recommendationsByKey.get(key);
    if (existing) {
      existing.ruleIds.push(rule.ruleId);
      existing.rationales = [...new Set([...existing.rationales, rule.rationale])];
      existing.rationale = existing.rationales.join(' ');
      existing.sources = [...new Set([...existing.sources, ...rule.sources])];
      existing.evidenceTypes = [...new Set([
        ...existing.evidenceTypes,
        ...factors.map(({ evidenceType }) => evidenceType),
      ])];
      const seenFactors = new Set(existing.triggeringFactors.map(({ field, value }) => `${field}:${JSON.stringify(value)}`));
      for (const factor of factors) {
        const factorKey = `${factor.field}:${JSON.stringify(factor.value)}`;
        if (!seenFactors.has(factorKey)) {
          existing.triggeringFactors.push(factor);
          seenFactors.add(factorKey);
        }
      }
      continue;
    }
    recommendationsByKey.set(key, {
      ruleId: rule.ruleId,
      ruleIds: [rule.ruleId],
      testName: rule.testName,
      category: rule.category,
      evidenceScope: 'lifestyle_profile_only',
      evidenceTypes: [...new Set(factors.map(({ evidenceType }) => evidenceType))],
      whatItMeasures: rule.whatItMeasures,
      rationale: rule.rationale,
      rationales: [rule.rationale],
      reason: rule.rationale,
      sources: [...rule.sources],
      triggeringFactors: factors,
      disclaimer,
    });
  }
  return [...recommendationsByKey.values()].map(({ rationales: _rationales, ...item }) => item);
}

export function evaluateTestRules(profile = {}, document = testRules) {
  validateTestRules(document);
  if (document.rules.length === 0) {
    throw new Error('The lifestyle recommendation rule catalog contains no active rules.');
  }
  return evaluateRuleSet(profile, document.rules, document.disclaimer);
}

// Retained for callers from the earlier review-gated implementation.
export const evaluateApprovedRuleSet = evaluateRuleSet;

export function getTestRuleCatalogStatus(document = testRules) {
  validateTestRules(document);
  const activeRuleCount = document.rules.length;
  return {
    version: document.version,
    catalogVersion: document.catalogVersion,
    status: activeRuleCount > 0 ? 'ready' : 'empty',
    activeRuleCount,
  };
}

export const testRules = validateTestRules(JSON.parse(readFileSync(RULES_PATH, 'utf8')));
export const DISCLAIMER = testRules.disclaimer;
export default testRules;
