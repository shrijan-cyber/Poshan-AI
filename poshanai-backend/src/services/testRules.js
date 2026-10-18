import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rulesPath = join(dirname(fileURLToPath(import.meta.url)), '../../data/testRules.json');
const allowedRuleText =
  /^(?:Consider discussing (?:whether|the option of|a) .+|You may wish to discuss .+) with your doctor\.?$/i;
const medicalClaimLanguage =
  /\b(?:diagnos(?:e|is)|treat(?:ment)?|cure|prevent(?:ion)?|you have|you are deficient|indicates? (?:a )?disease|causes? disease|must take|should take|prescribe)\b/i;

export function validateTestRules(rulesDocument) {
  if (!rulesDocument || rulesDocument.version !== 1 || !Array.isArray(rulesDocument.rules)) {
    throw new Error('testRules.json must contain version 1 and a rules array.');
  }
  if (
    typeof rulesDocument.disclaimer !== 'string' ||
    !/suggestions to discuss with a doctor/i.test(rulesDocument.disclaimer)
  ) {
    throw new Error(
      'testRules.json disclaimer must describe suggestions to discuss with a doctor.',
    );
  }

  const ids = new Set();
  for (const rule of rulesDocument.rules) {
    if (!rule || Object.keys(rule).some((key) => !['id', 'suggestion'].includes(key))) {
      throw new Error('testRules.json rules may only contain id and suggestion.');
    }
    if (typeof rule.id !== 'string' || !rule.id || ids.has(rule.id)) {
      throw new Error('testRules.json rule ids must be unique non-empty strings.');
    }
    if (
      typeof rule.suggestion !== 'string' ||
      !allowedRuleText.test(rule.suggestion) ||
      medicalClaimLanguage.test(rule.suggestion)
    ) {
      throw new Error(
        'Each test rule must be phrased only as a suggestion to discuss with a doctor.',
      );
    }
    ids.add(rule.id);
  }
  if (Object.keys(rulesDocument).some((key) => !['version', 'disclaimer', 'rules'].includes(key))) {
    throw new Error('testRules.json contains unsupported fields.');
  }
  return rulesDocument;
}

export function loadTestRules() {
  return validateTestRules(JSON.parse(readFileSync(rulesPath, 'utf8')));
}

export default { loadTestRules, validateTestRules };
