import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getIfctFoods } from '../rag/ifctLoader.js';
import { auditIfctFoods, IFCT_NUTRIENT_FIELDS } from '../rag/ifctDataValidation.js';
import { validateStagingBatch } from './foodDataStaging.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../..');
const manifestPath = path.join(__dirname, '../data/ifct-manifest.json');
const stagingDir = path.join(backendDir, 'data', 'staging');
const KNOWN_UNITS = new Set([
  'g', 'mg', 'ug', 'µg', 'mcg', 'kcal', 'kj', 'iu', 'ml', 'ml/g',
]);
const FIELD_LIMITS = Object.freeze({
  energy: { kcal: 900, kj: 4000 },
  macroGrams: 100,
  micronutrientMg: 10000,
  micronutrientMicrograms: 1_000_000,
});

const normalizedName = (value) => String(value ?? '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en')
  .replace(/[^a-z0-9]+/g, ' ').trim();

function normalizedUnit(value) {
  const key = String(value ?? '').trim().toLocaleLowerCase('en');
  if (key === 'μg' || key === 'mcg') return 'µg';
  return key;
}

function hasVerifiedFoodBasis(record) {
  return record?.nutritionBasis?.verificationStatus === 'verified'
    && record?.nutritionBasis?.sourceBasis === 'per_100g_edible_portion'
    && ['raw', 'cooked', 'dried', 'fresh', 'processed'].includes(record?.foodState)
    && record?.foodStateVerificationStatus === 'verified'
    && typeof record?.source?.sourceUrl === 'string'
    && typeof record?.source?.license === 'string';
}

function hasCompleteNutrients(nutrients) {
  return Array.isArray(nutrients) && nutrients.length > 0
    && nutrients.every((item) => item?.amount !== null && Number.isFinite(item?.amount)
      && typeof item?.unit === 'string' && KNOWN_UNITS.has(normalizedUnit(item.unit)));
}

function valuePlausibilityIssues(nutrients = []) {
  const issues = [];
  for (const nutrient of nutrients) {
    if (nutrient?.amount === null || !Number.isFinite(nutrient?.amount)) continue;
    const unit = normalizedUnit(nutrient.unit);
    const name = String(nutrient.name ?? '').toLocaleLowerCase('en');
    let limit = null;
    if (/energy|calorie/.test(name)) limit = unit === 'kcal' ? FIELD_LIMITS.energy.kcal : unit === 'kj' ? FIELD_LIMITS.energy.kj : null;
    else if (/protein|carbohydrate|carb|fat|fiber|fibre/.test(name) && unit === 'g') limit = FIELD_LIMITS.macroGrams;
    else if (unit === 'mg') limit = FIELD_LIMITS.micronutrientMg;
    else if (['ug', 'µg'].includes(unit)) limit = FIELD_LIMITS.micronutrientMicrograms;

    if (limit !== null && (nutrient.amount < 0 || nutrient.amount > limit)) {
      issues.push({ nutrientId: nutrient.nutrientId, name: nutrient.name, amount: nutrient.amount, unit: nutrient.unit, limit });
    }
  }
  return issues;
}

function findPotentialNameMatches(stagedRecords, ifctFoods) {
  const candidates = ifctFoods.map((food) => ({ food, name: normalizedName(food.foodName) }))
    .filter(({ name }) => name);
  const exactMatches = [];
  for (const record of stagedRecords) {
    // Branded label products remain a separate namespace and are not compared as generic foods.
    if (record.sourceId?.startsWith('off:')) continue;
    const label = record.description ?? record.foodName;
    const name = normalizedName(label);
    if (!name) continue;
    const tokens = new Set(name.split(' '));
    for (const { food, name: candidateName } of candidates) {
      const candidateTokens = new Set(candidateName.split(' '));
      const shared = [...tokens].filter((token) => candidateTokens.has(token)).length;
      const similarity = shared / new Set([...tokens, ...candidateTokens]).size;
      if (name === candidateName || (shared > 1 && similarity >= 0.85)) {
        exactMatches.push({ sourceId: record.sourceId, sourceName: label, ifctCode: food.ifctCode, ifctName: food.foodName, matchType: name === candidateName ? 'exact-normalized-name-review-only' : 'high-token-similarity-review-only' });
      }
    }
  }
  return exactMatches;
}

function emptyCounts() {
  return { validated: 0, needsReview: 0, rejected: 0, incomplete: 0, potentialDuplicates: 0 };
}

function auditIfctRecords(foods, manifest) {
  const sourceAudit = auditIfctFoods(foods, manifest);
  const duplicateCodes = new Set();
  const occurrences = new Map();
  for (const food of foods) {
    if (!food?.ifctCode) continue;
    occurrences.set(food.ifctCode, (occurrences.get(food.ifctCode) ?? 0) + 1);
  }
  for (const [code, count] of occurrences) if (count > 1) duplicateCodes.add(code);
  const invalidRecordIndexes = new Set();
  foods.forEach((food, index) => {
    if (!food || typeof food !== 'object' || Array.isArray(food)
      || typeof food.ifctCode !== 'string' || !/^[A-Z]\d{3}$/.test(food.ifctCode)
      || duplicateCodes.has(food.ifctCode)
      || typeof food.foodName !== 'string' || !food.foodName.trim()
      || !food.nutrients || typeof food.nutrients !== 'object' || Array.isArray(food.nutrients)) {
      invalidRecordIndexes.add(index);
      return;
    }
    for (const field of IFCT_NUTRIENT_FIELDS) {
      const value = food.nutrients[field];
      if (!Object.hasOwn(food.nutrients, field)
        || (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0))) {
        invalidRecordIndexes.add(index);
        break;
      }
    }
  });

  const counts = emptyCounts();
  const details = [];
  let missingNutrientRecords = 0;
  let missingNutrientValues = 0;
  let missingRecordFoodState = 0;
  let missingRecordSourceLocator = 0;
  const missingNutrientUnitMapping = IFCT_NUTRIENT_FIELDS.filter((field) => (
    manifest?.nutrientFields?.[field]?.mappingStatus === 'unverified'
  )).length;
  const suspiciousEnergySet = new Set(sourceAudit.suspiciousEnergyCodes);
  const duplicateNameCandidates = sourceAudit.duplicateNameGroups.map((group) => ({
    ...group,
    matchType: 'exact-normalized-name-review-only',
  }));
  const duplicateNameCodes = new Set(duplicateNameCandidates.flatMap(({ ifctCodes }) => ifctCodes));
  const macroEnergyMismatchCodes = sourceAudit.warnings
    .filter(({ code }) => code === 'ENERGY_MACRO_MISMATCH')
    .map(({ ifctCode }) => ifctCode);
  const macroEnergyMismatchSet = new Set(macroEnergyMismatchCodes);
  foods.forEach((food, index) => {
    const reasons = [];
    if (invalidRecordIndexes.has(index)) reasons.push('invalid identifier or food/nutrient data shape/value');
    const nutrientValues = IFCT_NUTRIENT_FIELDS.map((field) => food?.nutrients?.[field]);
    const recordMissing = nutrientValues.some((value) => value === null || value === undefined);
    if (recordMissing) missingNutrientRecords += 1;
    missingNutrientValues += nutrientValues.filter((value) => value === null || value === undefined).length;
    if (!['raw', 'cooked', 'dried', 'fresh', 'processed'].includes(food?.foodState)) {
      missingRecordFoodState += 1;
      reasons.push('food state is not verified at record level');
    }
    if (!food?.sourceReference) {
      missingRecordSourceLocator += 1;
      reasons.push('record-level source locator is unavailable');
    }
    if (!food?.nutritionBasis || food.nutritionBasis.verificationStatus !== 'verified') {
      reasons.push('per-100g edible-portion basis is not verified at record level');
    }
    if (missingNutrientUnitMapping) reasons.push('source nutrient unit mappings are unverified');
    if (recordMissing) reasons.push('one or more nutrient values are missing');
    if (duplicateCodes.has(food?.ifctCode)) reasons.push('duplicate IFCT code');
    if (duplicateNameCodes.has(food?.ifctCode)) reasons.push('normalized food name occurs under multiple IFCT codes; identity review required');
    if (suspiciousEnergySet.has(food?.ifctCode)) reasons.push('energy is zero while recorded fat is positive; requires source review');
    if (macroEnergyMismatchSet.has(food?.ifctCode)) reasons.push('energy and macro-derived energy differ beyond the existing audit tolerance; requires source review');

    const isRejected = invalidRecordIndexes.has(index);
    const isComplete = reasons.length === 0;
    const status = isRejected ? 'rejected' : isComplete ? 'validated'
      : suspiciousEnergySet.has(food?.ifctCode) || macroEnergyMismatchSet.has(food?.ifctCode)
        || duplicateCodes.has(food?.ifctCode) || duplicateNameCodes.has(food?.ifctCode) ? 'needsReview' : 'incomplete';
    counts[status] += 1;
    details.push({ sourceId: food?.ifctCode ?? null, name: food?.foodName ?? null, status, reasons });
  });

  counts.potentialDuplicates += duplicateNameCandidates.length;
  return {
    source: 'IFCT 2017 application subset',
    recordCount: foods.length,
    counts,
    nutrientCoverage: {
      missingValuesByField: sourceAudit.missingCounts,
      recordsWithAtLeastOneMissingValue: missingNutrientRecords,
      missingValueCount: missingNutrientValues,
      nutrientUnitMappingsUnverified: missingNutrientUnitMapping,
    },
    provenanceGaps: {
      recordLevelFoodStateMissing: missingRecordFoodState,
      recordLevelSourceLocatorMissing: missingRecordSourceLocator,
    },
    duplicateIfctCodeCount: duplicateCodes.size,
    duplicateNameCandidates,
    suspiciousEnergyCodes: sourceAudit.suspiciousEnergyCodes,
    macroEnergyMismatchCodes,
    warningCodes: [...new Set(sourceAudit.warnings.map(({ code }) => code))],
    validationErrors: sourceAudit.errors,
    records: details,
  };
}

function auditStagingBatches(batches, ifctFoods) {
  const counts = emptyCounts();
  const records = [];
  const rejected = [];
  const seenIds = new Set();
  const batchSummaries = [];
  const validationIssues = [];

  for (const batch of batches) {
    const batchValidation = validateStagingBatch(batch);
    const batchValid = batchValidation.valid;
    if (!batchValid) validationIssues.push(...batchValidation.errors.map((reason) => ({ batchId: batch?.batchId ?? null, reason })));
    batchSummaries.push({
      batchId: batch?.batchId ?? null,
      source: batch?.source ?? 'unknown',
      sourceVersion: batch?.sourceVersion ?? 'unknown',
      recordCount: batch?.records?.length ?? 0,
      rejectedRecordCount: batch?.rejectedRecords?.length ?? 0,
      productionImport: batch?.productionImport === true,
      reviewStatus: batch?.reviewStatus ?? 'unknown',
    });

    for (const rejectedRecord of batch?.rejectedRecords ?? []) {
      counts.rejected += 1;
      rejected.push({ sourceId: rejectedRecord.sourceId ?? null, batchId: batch?.batchId ?? null, reason: rejectedRecord.reason ?? 'Rejected by import validation.' });
    }
    for (const record of batch?.records ?? []) {
      const issues = [];
      if (!batchValid) issues.push('containing batch failed validation');
      if (seenIds.has(record?.sourceId)) issues.push('duplicate source identifier across staging batches');
      if (record?.eligibleForProduction !== false || batch?.productionImport !== false) issues.push('staging entry violates production-ineligible boundary');
      if (!record?.source?.license || !record?.source?.sourceId) issues.push('source license or stable source identifier missing');
      if (record?.sourceId?.startsWith('fdc:') && !hasVerifiedFoodBasis(record)) issues.push('per-100g edible-portion basis or raw/cooked state not verified');
      if (record?.sourceId?.startsWith('fdc:') && !hasCompleteNutrients(record.nutrients)) issues.push('nutrient values or units incomplete/unverified');
      if (record?.sourceId?.startsWith('off:')) issues.push('branded-label data requires separate label and license review');
      const unitIssues = (record?.nutrients ?? []).filter((item) => !item?.unit || !KNOWN_UNITS.has(normalizedUnit(item.unit)));
      if (unitIssues.length) issues.push(`unsupported or missing nutrient units: ${[...new Set(unitIssues.map(({ unit }) => unit || 'missing'))].join(', ')}`);
      if ((record?.nutrients ?? []).some((item) => !item?.nutrientId || !item?.name)) issues.push('nutrient identifier or name missing');
      const implausibleValues = valuePlausibilityIssues(record?.nutrients);
      if (implausibleValues.length) issues.push('one or more values exceed documented plausibility bounds');

      const duplicate = seenIds.has(record?.sourceId);
      if (record?.sourceId) seenIds.add(record.sourceId);
      const status = issues.length === 0 ? 'validated' : duplicate ? 'rejected' : 'needsReview';
      counts[status] += 1;
      if (duplicate) counts.potentialDuplicates += 1;
      records.push({
        sourceId: record?.sourceId ?? null,
        name: record?.description ?? record?.productName ?? null,
        source: batch?.source ?? null,
        batchId: batch?.batchId ?? null,
        status,
        reasons: issues,
        implausibleValues,
      });
      if (record?.sourceId?.startsWith('fdc:')) {
        const matches = findPotentialNameMatches([record], ifctFoods);
        for (const match of matches) {
          counts.potentialDuplicates += 1;
          records.at(-1).potentialDuplicate = match;
        }
      }
    }
  }

  return {
    source: 'External staging batches',
    batchCount: batches.length,
    recordCount: records.length,
    counts,
    batches: batchSummaries,
    records,
    rejectedRecords: rejected,
    validationIssues,
    automaticPromotionEnabled: false,
  };
}

export function evaluatePromotionApproval(record, approval) {
  const errors = [];
  if (record?.eligibleForProduction !== true) errors.push('Record is not explicitly eligible for production.');
  if (record?.verificationStatus !== 'verified') errors.push('Food identity and source verification are incomplete.');
  if (!hasVerifiedFoodBasis(record)) errors.push('Nutrient basis and food state must be verified.');
  if (!hasCompleteNutrients(record?.nutrients)) errors.push('Nutrient records must have non-null values and supported units.');
  if (approval?.approved !== true) errors.push('Explicit human approval is required.');
  if (typeof approval?.reviewerId !== 'string' || !approval.reviewerId.trim()) errors.push('Reviewer identity is required.');
  if (!Number.isFinite(Date.parse(approval?.approvedAt))) errors.push('Approval timestamp is required.');
  if (!Array.isArray(approval?.evidenceReviewed) || !['identity', 'license', 'nutrient_units', 'edible_portion_basis', 'food_state', 'duplicate_search']
    .every((field) => approval.evidenceReviewed.includes(field))) {
    errors.push('Approval must document review of identity, license, nutrient units, edible-portion basis, food state, and duplicate search.');
  }
  if (approval?.potentialDuplicatesResolved !== true) errors.push('Potential duplicate review must be explicitly resolved.');
  if (record?.potentialDuplicate === true) errors.push('Potential duplicate must be resolved before promotion.');
  return { approved: errors.length === 0, errors };
}

export function buildFoodDataQualityReport({ ifctFoods = getIfctFoods(), manifest = null, stagingBatches = [], generatedAt = new Date().toISOString() } = {}) {
  const ifct = auditIfctRecords(ifctFoods, manifest);
  const staging = auditStagingBatches(stagingBatches, ifctFoods);
  return {
    reportVersion: 1,
    generatedAt,
    policy: {
      sourceRecordMutation: false,
      automaticPromotion: false,
      matchingByNameOnly: false,
      unknownValuesRemainNull: true,
      validationBounds: FIELD_LIMITS,
      unitsReviewedButNotConverted: true,
    },
    totals: {
      foodRecords: ifct.recordCount + staging.recordCount,
      ifctRecords: ifct.recordCount,
      externalStagingRecords: staging.recordCount,
      stagingBatches: staging.batchCount,
      validated: ifct.counts.validated + staging.counts.validated,
      needsReview: ifct.counts.needsReview + staging.counts.needsReview,
      rejected: ifct.counts.rejected + staging.counts.rejected,
      incomplete: ifct.counts.incomplete + staging.counts.incomplete,
      potentialDuplicates: ifct.counts.potentialDuplicates + staging.counts.potentialDuplicates,
    },
    sources: [ifct, staging],
    promotionApprovalGate: {
      enabled: true,
      automaticPromotion: false,
      requiredEvidence: ['identity', 'license', 'nutrient_units', 'edible_portion_basis', 'food_state', 'duplicate_search'],
      note: 'This report and gate do not perform or authorize a catalog write; a trusted promotion workflow must enforce reviewer authorization and call evaluatePromotionApproval.',
    },
  };
}

export function loadStagingBatches(directory = stagingDir) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name }) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')));
}

export function runFoodDataQualityAudit({ ifctFoods = getIfctFoods(), manifest = null, stagingBatches, generatedAt } = {}) {
  const resolvedManifest = manifest ?? JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const resolvedBatches = stagingBatches ?? loadStagingBatches();
  return buildFoodDataQualityReport({ ifctFoods, manifest: resolvedManifest, stagingBatches: resolvedBatches, generatedAt });
}

export default { buildFoodDataQualityReport, runFoodDataQualityAudit, evaluatePromotionApproval, loadStagingBatches };
