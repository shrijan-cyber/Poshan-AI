import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  auditIfctFoods,
  IFCT_DATA_STATUSES,
  validateDatasetChecksum,
  validateIfctManifest,
} from '../src/rag/ifctDataValidation.js';
import { getIfctFoods, getIfctValidationReport, loadIfctDataset } from '../src/rag/ifctLoader.js';
import { calculateIfctNutrition } from '../src/services/dietService.js';
import { getFoodByCode, sumNutrients } from '../src/services/foodCatalog.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.resolve(__dirname, '../data/ifct_2017.json');
const manifestPath = path.resolve(__dirname, '../src/data/ifct-manifest.json');
const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

test('manifest is explicit, versioned, and checksum-bound to the runtime artifact', () => {
  assert.deepEqual(validateIfctManifest(manifest), { valid: true, errors: [] });
  assert.equal(manifest.dataset.source.sourceFileAvailable, false);
  assert.equal(manifest.dataset.source.sourceFileSha256, null);
  assert.equal(manifest.dataset.source.sourceColumnMappingVerified, false);
  assert.deepEqual(validateDatasetChecksum(fs.readFileSync(datasetPath), manifest.dataset.sha256).valid, true);
  assert.deepEqual(IFCT_DATA_STATUSES, ['analytical', 'derived', 'label_reported', 'estimated', 'missing']);
});

test('current catalog integrity and missing-value counts are reported without changing records', () => {
  const originalOilEnergy = dataset.find((food) => food.ifctCode === 'T013').nutrients.calories;
  const report = auditIfctFoods(dataset, manifest);

  assert.equal(report.valid, true);
  assert.equal(report.recordCount, 542);
  assert.equal(report.uniqueCodeCount, 542);
  assert.deepEqual(report.duplicateNameGroups, [
    { foodName: 'cat fish', ifctCodes: ['P009', 'S001'] },
    { foodName: 'crab', ifctCodes: ['Q001', 'S007'] },
  ]);
  assert.equal(report.missingCounts.vitaminB12, 542);
  assert.equal(report.missingCounts.fiber, 542);
  assert.deepEqual(report.suspiciousEnergyCodes, Array.from({ length: 14 }, (_, index) => `T${String(index + 1).padStart(3, '0')}`));
  assert.ok(report.warnings.some((warning) => warning.code === 'RECORD_COUNT_DIFFERS_FROM_SOURCE_PUBLICATION'
    && warning.applicationRecordCount === 542 && warning.publishedRecordCount === 528));
  assert.equal(dataset.find((food) => food.ifctCode === 'T013').nutrients.calories, originalOilEnergy);
});

test('duplicate IFCT codes, invalid names, and negative nutrient values are rejected', () => {
  const record = {
    ifctCode: 'A001', foodName: 'Food', nutrients: {
      calories: 100, protein: 1, carbs: 1, fat: 1, iron: 1, calcium: 1, vitaminD: 1,
      vitaminB12: null, fiber: null,
    },
  };
  const duplicateReport = auditIfctFoods([record, { ...record, nutrients: { ...record.nutrients } }]);
  assert.equal(duplicateReport.valid, false);
  assert.ok(duplicateReport.errors.some((message) => message.includes('Duplicate IFCT code A001')));

  const negativeReport = auditIfctFoods([{ ...record, foodName: ' ', nutrients: { ...record.nutrients, iron: -1 } }]);
  assert.equal(negativeReport.valid, false);
  assert.ok(negativeReport.errors.some((message) => message.includes('no food name')));
  assert.ok(negativeReport.errors.some((message) => message.includes('invalid iron')));
});

test('legitimate zero values remain valid and distinct from missing values', () => {
  const record = {
    ifctCode: 'A001', foodName: 'Valid zero record', nutrients: {
      calories: 0, protein: 0, carbs: 0, fat: 0, iron: 0, calcium: 0, vitaminD: 0,
      vitaminB12: null, fiber: null,
    },
  };
  const report = auditIfctFoods([record]);

  assert.equal(report.valid, true);
  assert.equal(report.missingCounts.vitaminB12, 1);
  assert.equal(report.missingCounts.iron, 0);
  assert.deepEqual(report.suspiciousEnergyCodes, []);
});

test('zero-energy oil records are flagged, preserved in the source loader, and not used for calculations', () => {
  const rawOil = loadIfctDataset().find((food) => food.ifctCode === 'T013');
  const cachedOil = getIfctFoods().find((food) => food.ifctCode === 'T013');
  const validationReport = getIfctValidationReport();

  assert.equal(rawOil.nutrients.calories, 0);
  assert.equal(rawOil.nutrients.fat, 100);
  assert.equal(cachedOil.nutrients.calories, 0);
  assert.equal(getFoodByCode('T013').nutrients.calories, null);
  assert.ok(validationReport.suspiciousEnergyCodes.includes('T013'));
  assert.throws(() => calculateIfctNutrition(cachedOil, 5), (error) => error.code === 'IFCT_ENERGY_UNRESOLVED');
});

test('nullable aggregation never converts undefined or null nutrients to zero', () => {
  const totals = sumNutrients([
    { calories: 10, protein: 1, carbs: 2, fat: 3 },
    { calories: undefined, protein: null, carbs: 0, fat: 0 },
  ]);

  assert.equal(totals.calories, null);
  assert.equal(totals.protein, null);
  assert.equal(totals.carbs, 2);
  assert.equal(totals.fat, 3);
});
