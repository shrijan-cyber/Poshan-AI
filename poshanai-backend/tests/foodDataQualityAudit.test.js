import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFoodDataQualityReport,
  evaluatePromotionApproval,
} from '../src/services/foodDataQualityAudit.js';

const fields = ['calories', 'protein', 'carbs', 'fat', 'iron', 'calcium', 'vitaminD', 'vitaminB12', 'fiber'];
const manifest = {
  nutrientFields: Object.fromEntries(fields.map((field) => [field, { mappingStatus: field === 'vitaminB12' || field === 'fiber' ? 'unavailable-in-application-subset' : 'unverified' }])),
  dataset: { source: { sourceColumnMappingVerified: false }, officialReportedFoodCount: 528 },
};

function ifctFood({ code = 'A001', name = 'Test grain', nutrients = {} } = {}) {
  return {
    ifctCode: code,
    foodName: name,
    nutrients: Object.fromEntries(fields.map((field) => [field, Object.hasOwn(nutrients, field)
      ? nutrients[field]
      : field === 'vitaminB12' || field === 'fiber' ? null : 1])),
  };
}

function stagingRecord({ sourceId = 'fdc:123', batchId = 'fdc-123456789012345678901234', description = 'Test grain', foodState = null } = {}) {
  return {
    stagingSchemaVersion: 2,
    sourceId,
    source: { name: 'USDA FoodData Central', sourceId: sourceId.replace('fdc:', ''), license: 'CC0-1.0', sourceUrl: 'https://fdc.nal.usda.gov/food-details/123/nutrients' },
    description,
    nutrients: [{ nutrientId: '1003', name: 'Protein', unit: 'g', amount: 1 }],
    nutritionBasis: { target: 'per_100g_edible_portion', sourceBasis: null, verificationStatus: 'pending_source_basis_review' },
    foodState,
    foodStateVerificationStatus: foodState ? 'pending_state_review' : 'pending_state_review',
    contentHash: 'a'.repeat(64),
    eligibleForProduction: false,
    verificationStatus: 'pending_identity_unit_basis_and_state_review',
    batchId,
  };
}

function batch(records, { batchId = 'fdc-123456789012345678901234', rejectedRecords = [] } = {}) {
  return {
    schemaVersion: 2,
    batchId,
    source: 'fdc',
    sourceVersion: 'Foundation',
    importedAt: '2026-11-01T00:00:00.000Z',
    recordCount: records.length,
    rejectedRecordCount: rejectedRecords.length,
    productionImport: false,
    reviewStatus: 'staging_review_required',
    records,
    rejectedRecords,
  };
}

test('IFCT report preserves missing values and identifies unverified basis, units, and raw/cooked state', () => {
  const report = buildFoodDataQualityReport({ ifctFoods: [ifctFood({ nutrients: { calories: 17 } })], manifest, stagingBatches: [], generatedAt: '2026-11-02T00:00:00.000Z' });
  const ifct = report.sources[0];
  assert.equal(report.totals.ifctRecords, 1);
  assert.equal(ifct.counts.incomplete, 1);
  assert.equal(ifct.nutrientCoverage.missingValuesByField.vitaminB12, 1);
  assert.equal(ifct.nutrientCoverage.missingValuesByField.fiber, 1);
  assert.equal(ifct.nutrientCoverage.nutrientUnitMappingsUnverified, 7);
  assert.equal(ifct.provenanceGaps.recordLevelFoodStateMissing, 1);
  assert.equal(ifct.provenanceGaps.recordLevelSourceLocatorMissing, 1);
});

test('IFCT duplicate names and suspicious energy values are flagged for review without merging', () => {
  const foods = [
    ifctFood({ code: 'P009', name: 'Cat fish', nutrients: { calories: 0, fat: 5 } }),
    ifctFood({ code: 'S001', name: 'cat  fish' }),
  ];
  const report = buildFoodDataQualityReport({ ifctFoods: foods, manifest, stagingBatches: [] });
  const ifct = report.sources[0];
  assert.equal(ifct.counts.potentialDuplicates, 1);
  assert.equal(ifct.duplicateNameCandidates[0].matchType, 'exact-normalized-name-review-only');
  assert.equal(ifct.counts.needsReview, 2);
  assert.deepEqual(ifct.suspiciousEnergyCodes, ['P009']);
  assert.equal(ifct.recordCount, foods.length);
});

test('invalid values are reported as rejected data, while null remains an incomplete unknown', () => {
  const report = buildFoodDataQualityReport({
    ifctFoods: [ifctFood({ nutrients: { protein: -1, carbs: null } })], manifest, stagingBatches: [],
  });
  assert.ok(report.sources[0].validationErrors.some((error) => error.includes('invalid protein')));
  assert.equal(report.sources[0].nutrientCoverage.missingValuesByField.carbs, 1);
  assert.equal(report.sources[0].counts.rejected, 1);
});

test('staging audit reports pending review and duplicate source IDs without promotion', () => {
  const firstId = 'fdc-123456789012345678901234';
  const secondId = 'fdc-abcdef123456789012345678';
  const batches = [
    batch([stagingRecord({ batchId: firstId, description: 'Imported cereal sample' })], { batchId: firstId, rejectedRecords: [{ sourceId: 'fdc:bad', reason: 'invalid nutrients' }] }),
    batch([stagingRecord({ batchId: secondId, description: 'Imported cereal sample' })], { batchId: secondId }),
  ];
  const report = buildFoodDataQualityReport({ ifctFoods: [ifctFood()], manifest, stagingBatches: batches });
  const staging = report.sources[1];
  assert.equal(staging.counts.needsReview, 1);
  assert.equal(staging.counts.rejected, 2); // one rejected import row and one duplicate source ID
  assert.equal(staging.counts.potentialDuplicates, 1);
  assert.equal(staging.automaticPromotionEnabled, false);
  assert.equal(report.policy.automaticPromotion, false);
});

test('staging audit flags unrecognized units and implausible per-100g values', () => {
  const batchId = 'fdc-111111111111111111111111';
  const record = stagingRecord({ batchId, description: 'A different food' });
  record.nutrients = [
    { nutrientId: '1003', name: 'Protein', unit: 'g', amount: 101 },
    { nutrientId: '1008', name: 'Energy', unit: 'made-up', amount: 500 },
  ];
  const report = buildFoodDataQualityReport({
    ifctFoods: [ifctFood()], manifest, stagingBatches: [batch([record], { batchId })],
  });
  const audited = report.sources[1].records[0];
  assert.equal(audited.status, 'needsReview');
  assert.ok(audited.reasons.some((reason) => reason.includes('unsupported or missing nutrient units')));
  assert.ok(audited.reasons.some((reason) => reason.includes('plausibility bounds')));
  assert.equal(audited.implausibleValues[0].name, 'Protein');
});

test('promotion gate requires explicit human approval and complete provenance evidence', () => {
  const staged = stagingRecord();
  assert.equal(evaluatePromotionApproval(staged, { approved: true }).approved, false);

  const reviewed = {
    ...staged,
    eligibleForProduction: true,
    verificationStatus: 'verified',
    nutritionBasis: { target: 'per_100g_edible_portion', sourceBasis: 'per_100g_edible_portion', verificationStatus: 'verified' },
    foodState: 'raw',
    foodStateVerificationStatus: 'verified',
    nutrients: fields.map((name, index) => ({ nutrientId: String(index + 1), name, unit: index === 0 ? 'kcal' : 'g', amount: 1 })),
  };
  const approval = {
    approved: true,
    reviewerId: 'reviewer-1',
    approvedAt: '2026-11-02T00:00:00.000Z',
    evidenceReviewed: ['identity', 'license', 'nutrient_units', 'edible_portion_basis', 'food_state', 'duplicate_search'],
    potentialDuplicatesResolved: true,
  };
  assert.deepEqual(evaluatePromotionApproval(reviewed, approval), { approved: true, errors: [] });
});
