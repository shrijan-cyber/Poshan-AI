import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { writeBatchIdempotently } from '../src/scripts/stageFoodData.js';
import {
  prepareFdcImport,
  prepareOpenFoodFactsImport,
  stageFdcFoods,
  stageOpenFoodFactsProducts,
  validateStagingBatch,
} from '../src/services/foodDataStaging.js';

const importedAt = '2026-01-01T00:00:00.000Z';

function fdcFood(overrides = {}) {
  return {
    fdcId: 123,
    dataType: 'Foundation',
    description: 'Example food',
    publicationDate: '2024-10-29',
    foodCategory: { description: 'Legumes' },
    foodNutrients: [
      { nutrient: { id: 1003, name: 'Protein', unitName: 'g' }, amount: 4.2 },
      { nutrient: { id: 1178, name: 'Vitamin B12', unitName: 'µg' }, amount: null },
      { nutrient: { id: 1008, name: 'Energy', unitName: 'kcal' }, amount: 0 },
    ],
    ...overrides,
  };
}

test('FDC API search wrapper preserves source metadata, IDs, nutrient units, nulls and zero', () => {
  const batch = prepareFdcImport({
    data: { foods: [fdcFood()] },
    sourceMetadata: { sourceVersion: 'fdc-search-v1', retrievedAt: importedAt, api_key: 'must-not-persist', endpoint: 'foods/search?api_key=hidden' },
  });
  const [food] = batch.records;

  assert.equal(batch.schemaVersion, 2);
  assert.equal(batch.source, 'fdc');
  assert.equal(batch.sourceVersion, 'fdc-search-v1');
  assert.equal(batch.importedAt, importedAt);
  assert.equal(food.source.fdcId, 123);
  assert.equal(food.source.dataType, 'Foundation');
  assert.equal(food.source.sourceVersion, 'Foundation|2024-10-29');
  assert.equal(food.source.sourceMetadata.endpoint, 'foods/search?api_key=[REDACTED]');
  assert.equal(Object.hasOwn(food.source.sourceMetadata, 'api_key'), false);
  assert.deepEqual(food.nutrients, [
    { nutrientId: '1003', name: 'Protein', unit: 'g', amount: 4.2, amountStatus: 'source_reported' },
    { nutrientId: '1178', name: 'Vitamin B12', unit: 'µg', amount: null, amountStatus: 'unknown' },
    { nutrientId: '1008', name: 'Energy', unit: 'kcal', amount: 0, amountStatus: 'source_reported' },
  ]);
  assert.deepEqual(food.nutritionBasis, {
    target: 'per_100g_edible_portion',
    sourceBasis: null,
    verificationStatus: 'pending_source_basis_review',
  });
  assert.equal(food.foodState, null);
  assert.equal(food.eligibleForProduction, false);
  assert.equal(batch.productionImport, false);
  assert.deepEqual(validateStagingBatch(batch), { valid: true, errors: [] });
});

test('FDC detail and downloaded typed datasets are accepted; legacy helper returns records', () => {
  const detail = prepareFdcImport(fdcFood());
  const downloaded = prepareFdcImport({ FoundationFoods: [{ ...fdcFood(), dataType: undefined }] }, { importedAt });
  assert.equal(detail.records[0].sourceId, 'fdc:123');
  assert.equal(downloaded.records[0].source.dataType, 'Foundation');
  assert.equal(stageFdcFoods({ foods: [fdcFood()] }, { importedAt }).length, 1);
});

test('FDC staging reports invalid and duplicate records without losing valid records', () => {
  const batch = prepareFdcImport({ foods: [
    fdcFood(),
    fdcFood({ description: '' }),
    fdcFood({ description: 'Duplicate ID' }),
    fdcFood({ fdcId: 456, description: 'Malformed nutrient', foodNutrients: [{ nutrient: { id: 1 }, amount: -1 }] }),
    null,
  ] }, { importedAt });

  assert.equal(batch.records.length, 1);
  assert.equal(batch.rejectedRecords.length, 4);
  assert.match(batch.rejectedRecords[0].reason, /description is required/);
  assert.match(batch.rejectedRecords[1].reason, /Duplicate source identifier/);
  assert.match(batch.rejectedRecords[2].reason, /nutrient name/);
  assert.equal(typeof batch.rejectedRecords[3].reason, 'string');
});

test('FDC import IDs are content-stable across timestamps and input order', () => {
  const first = prepareFdcImport({ foods: [fdcFood(), fdcFood({ fdcId: 456, description: 'Second food' })] }, { importedAt });
  const second = prepareFdcImport({ foods: [fdcFood({ fdcId: 456, description: 'Second food' }), fdcFood()] }, { importedAt: '2026-02-01T00:00:00.000Z' });
  const changed = prepareFdcImport({ foods: [fdcFood({ description: 'Changed source record' }), fdcFood({ fdcId: 456, description: 'Second food' })] }, { importedAt });

  assert.equal(first.batchId, second.batchId);
  assert.notEqual(first.batchId, changed.batchId);
});

test('staging writer is idempotent for the same batch and refuses a different batch overwrite', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'poshanai-food-stage-'));
  try {
    const outputPath = path.join(directory, 'batch.json');
    const batch = { batchId: 'fdc-123456789012345678901234', records: [] };
    assert.equal(writeBatchIdempotently(outputPath, batch), 'created');
    const before = fs.readFileSync(outputPath, 'utf8');
    assert.equal(writeBatchIdempotently(outputPath, { ...batch, importedAt: 'later' }), 'already-staged');
    assert.equal(fs.readFileSync(outputPath, 'utf8'), before);
    assert.throws(() => writeBatchIdempotently(outputPath, { batchId: 'fdc-abcdefabcdefabcdefabcdef' }), /Refusing to overwrite/);
    assert.equal(fs.readFileSync(outputPath, 'utf8'), before);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Open Food Facts staging keeps branded label data separate and reports missing/duplicate barcodes', () => {
  const batch = prepareOpenFoodFactsImport({ products: [
    { code: '12345', product_name: 'Packaged curd', brands: 'Example', ingredients_text: 'Milk', allergens_tags: ['en:milk'], nutriments: { proteins_100g: 3.1 }, quantity: '400 g' },
    { code: '12345', product_name: 'Duplicate barcode' },
    { product_name: 'Missing barcode' },
  ] }, { importedAt });
  const [product] = batch.records;

  assert.equal(product.source.license, 'ODbL-1.0');
  assert.equal(product.labelNutrition.proteins_100g, 3.1);
  assert.equal(Object.hasOwn(product, 'nutrients'), false);
  assert.equal(product.eligibleForProduction, false);
  assert.equal(batch.records.length, 1);
  assert.equal(batch.rejectedRecords.length, 2);
  assert.match(batch.rejectedRecords[0].reason, /Duplicate source identifier/);
  assert.match(batch.rejectedRecords[1].reason, /stable barcode/);
  assert.equal(validateStagingBatch(batch).valid, true);
  assert.equal(stageOpenFoodFactsProducts({ products: [{ code: '12345' }] }, { importedAt }).length, 1);
});

test('malformed payloads are rejected and staged batch validation catches unsafe mutations', () => {
  assert.throws(() => prepareFdcImport({}), /food detail, search response/);
  assert.throws(() => prepareOpenFoodFactsImport({}), /products array/);
  const batch = prepareFdcImport({ foods: [fdcFood()] }, { importedAt });
  batch.records[0].eligibleForProduction = true;
  assert.equal(validateStagingBatch(batch).valid, false);
});
