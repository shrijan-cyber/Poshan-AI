import httpError from '../utils/httpError.js';

const conditionAliases = new Map([
  ['diabetes', 'diabetes'],
  ['type 1 diabetes', 'diabetes'],
  ['type 2 diabetes', 'diabetes'],
  ['kidney disease', 'kidney disease'],
  ['chronic kidney disease', 'kidney disease'],
  ['renal disease', 'kidney disease'],
  ['pregnancy', 'pregnancy'],
  ['pregnant', 'pregnancy'],
]);

const normalize = (value) => String(value ?? '').toLocaleLowerCase('en').trim().replace(/[\s_-]+/g, ' ');
const blockedConditions = new Set(['diabetes', 'kidney disease', 'pregnancy']);

export function getHighRiskConditions(conditions = []) {
  return conditions
    .map((condition) => {
      const value = normalize(condition);
      if (conditionAliases.has(value)) return conditionAliases.get(value);
      if (/\bdiabetes\b/.test(value)) return 'diabetes';
      if (/\b(?:kidney|renal) disease\b|\brenal failure\b/.test(value)) return 'kidney disease';
      if (/\b(?:pregnan\w*|expecting a baby)\b/.test(value)) return 'pregnancy';
      return value;
    })
    .filter((condition) => blockedConditions.has(condition));
}

export function assertNoHighRiskConditions(conditions = []) {
  const highRisk = getHighRiskConditions(conditions);
  if (highRisk.length > 0) {
    throw httpError(
      422,
      'PROFESSIONAL_REVIEW_REQUIRED',
      'This diet planner cannot safely create a plan for the medical conditions provided. Please consult a qualified healthcare professional for individualized nutrition advice.',
    );
  }
}

export default { getHighRiskConditions, assertNoHighRiskConditions };
