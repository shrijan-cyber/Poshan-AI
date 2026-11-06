import { createHash } from 'node:crypto';

const SOURCE_DEFINITIONS = Object.freeze({
  fdc: { name: 'USDA FoodData Central', license: 'CC0-1.0' },
  off: { name: 'Open Food Facts', license: 'ODbL-1.0' },
});
const FDC_COLLECTION_TYPES = Object.freeze({
  FoundationFoods: 'Foundation',
  SRLegacyFoods: 'SR Legacy',
  SurveyFoods: 'Survey (FNDDS)',
  BrandedFoods: 'Branded',
});
const ALLOWED_FOOD_STATES = new Set(['raw', 'cooked', 'dried', 'fresh', 'processed']);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function sanitizeSourceMetadata(value, depth = 0) {
  if (depth > 6 || value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    if (typeof value === 'string') {
      return value.replace(/([?&](?:api[_-]?key|authorization|access[_-]?token|secret|password|token)=)[^&#]*/gi, '$1[REDACTED]');
    }
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeSourceMetadata(item, depth + 1));
  if (!value || typeof value !== 'object') return null;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(?:api[_-]?key|authorization|access[_-]?token|secret|password|token)/i.test(key))
    .slice(0, 100)
    .map(([key, item]) => [key, sanitizeSourceMetadata(item, depth + 1)]));
}

function stableJson(value) {
  if (value === undefined) return '"__undefined__"';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function validTimestamp(value, fallback = () => new Date().toISOString()) {
  if (value === undefined) return fallback();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error('importedAt must be a valid timestamp.');
  return parsed.toISOString();
}

function nullableNonNegativeNumber(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be a non-negative finite number or null.`);
  return number;
}

function extractFdcFoods(payload) {
  if (Array.isArray(payload)) return payload.map((food) => ({ food, inferredDataType: null }));
  if (!payload || typeof payload !== 'object') return null;
  if (Number.isInteger(payload.fdcId)) return [{ food: payload, inferredDataType: null }];
  if (Array.isArray(payload.foods)) return payload.foods.map((food) => ({ food, inferredDataType: null }));

  const collections = Object.entries(FDC_COLLECTION_TYPES)
    .filter(([key]) => Array.isArray(payload[key]));
  if (collections.length === 1) {
    const [key, dataType] = collections[0];
    return payload[key].map((food) => ({ food, inferredDataType: dataType }));
  }
  if (collections.length > 1) {
    return collections.flatMap(([key, dataType]) => payload[key].map((food) => ({ food, inferredDataType: dataType })));
  }
  return null;
}

function normalizeFdcNutrient(item, index) {
  const nutrient = item?.nutrient ?? item ?? {};
  const id = nutrient.id ?? item?.nutrientId ?? nutrient.number ?? item?.number;
  const name = nutrient.name ?? item?.nutrientName;
  const unit = nutrient.unitName ?? item?.unitName ?? nutrient.unit ?? item?.unit ?? null;
  if ((typeof id !== 'string' && !Number.isInteger(id)) || !String(id).trim()) {
    throw new Error(`foodNutrients[${index}] is missing a stable nutrient identifier.`);
  }
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error(`foodNutrients[${index}] is missing a nutrient name.`);
  }
  if (unit !== null && (typeof unit !== 'string' || !unit.trim())) {
    throw new Error(`foodNutrients[${index}] has an invalid unit.`);
  }
  const rawAmount = item?.amount ?? item?.value;
  return {
    nutrientId: String(id),
    name: name.trim(),
    unit: unit?.trim() ?? null,
    amount: nullableNonNegativeNumber(rawAmount, `foodNutrients[${index}].amount`),
    amountStatus: rawAmount === null || rawAmount === undefined ? 'unknown' : 'source_reported',
  };
}

function fdcSourceVersion(food) {
  const parts = [food.dataType, food.publicationDate, food.modifiedDate, food.availableDate]
    .filter((part) => typeof part === 'string' && part.trim());
  return parts.length ? parts.join('|') : 'not-reported';
}

function toFdcRecord(food, inferredDataType, importedAt, sourceMetadata = null) {
  if (!food || typeof food !== 'object' || Array.isArray(food)) throw new Error('FDC food record must be an object.');
  const id = food.fdcId;
  if (!Number.isInteger(id) || id < 1) throw new Error('FDC record is missing a valid fdcId.');
  const description = food.description;
  if (typeof description !== 'string' || !description.trim()) throw new Error(`FDC ${id} description is required.`);
  const dataType = typeof food.dataType === 'string' && food.dataType.trim()
    ? food.dataType.trim()
    : inferredDataType;
  if (!dataType) throw new Error(`FDC ${id} dataType is required.`);
  const foodNutrients = food.foodNutrients ?? [];
  if (!Array.isArray(foodNutrients)) throw new Error(`FDC ${id} foodNutrients must be an array.`);
  const nutrients = foodNutrients.map(normalizeFdcNutrient);
  const sourceVersion = fdcSourceVersion({ ...food, dataType });
  const contentHash = sha256(stableJson(food));

  return {
    stagingSchemaVersion: 2,
    sourceId: `fdc:${id}`,
    source: {
      name: SOURCE_DEFINITIONS.fdc.name,
      sourceId: String(id),
      fdcId: id,
      dataType,
      sourceVersion,
      sourceMetadata,
      publicationDate: food.publicationDate ?? null,
      modifiedDate: food.modifiedDate ?? null,
      availableDate: food.availableDate ?? null,
      foodClass: food.foodClass ?? null,
      category: food.foodCategory?.description ?? food.foodCategory ?? null,
      retrievedAt: importedAt,
      license: SOURCE_DEFINITIONS.fdc.license,
      sourceUrl: `https://fdc.nal.usda.gov/food-details/${id}/nutrients`,
    },
    description: description.trim(),
    foodCategory: food.foodCategory?.description ?? food.foodCategory ?? null,
    foodPortions: Array.isArray(food.foodPortions) ? food.foodPortions : [],
    nutrients,
    nutritionBasis: {
      target: 'per_100g_edible_portion',
      sourceBasis: null,
      verificationStatus: 'pending_source_basis_review',
    },
    foodState: null,
    foodStateVerificationStatus: 'pending_state_review',
    contentHash,
    eligibleForProduction: false,
    verificationStatus: 'pending_identity_unit_basis_and_state_review',
  };
}

function rejectRecord(sourceId, index, error, rawRecord) {
  return {
    sourceId: sourceId ?? null,
    inputIndex: index,
    reason: error.message,
    contentHash: sha256(stableJson(rawRecord)),
  };
}

function makeBatchId(source, sourceVersion, records, rejectedRecords) {
  const identity = {
    source,
    sourceVersion,
    accepted: records.map(({ sourceId, contentHash }) => `${sourceId}:${contentHash}`).sort(),
    rejected: rejectedRecords.map(({ sourceId, contentHash, reason }) => `${sourceId ?? ''}:${contentHash}:${reason}`).sort(),
  };
  return `${source}-${sha256(stableJson(identity)).slice(0, 24)}`;
}

function finalizeBatch(source, sourceVersion, records, rejectedRecords, importedAt, sourceMetadata = null) {
  const batchId = makeBatchId(source, sourceVersion, records, rejectedRecords);
  return {
    schemaVersion: 2,
    batchId,
    source,
    sourceVersion,
    sourceMetadata,
    importedAt,
    recordCount: records.length,
    rejectedRecordCount: rejectedRecords.length,
    productionImport: false,
    reviewStatus: 'staging_review_required',
    records: records.map((record) => ({ ...record, batchId, importedAt })),
    rejectedRecords,
  };
}

/**
 * Validate and stage FDC search, detail, or downloaded food arrays.
 * Records retain source values/units and remain ineligible for production.
 */
export function prepareFdcImport(input, options = {}) {
  const wrapped = input && typeof input === 'object' && !Array.isArray(input)
    && Object.hasOwn(input, 'data') && Object.hasOwn(input, 'sourceMetadata');
  const payload = wrapped ? input.data : input;
  const sourceMetadata = sanitizeSourceMetadata(wrapped ? input.sourceMetadata : options.sourceMetadata ?? null);
  const entries = extractFdcFoods(payload);
  if (!entries) throw new Error('FDC input must be a food detail, search response, or recognized food array.');
  const importedAt = validTimestamp(options.importedAt ?? sourceMetadata?.retrievedAt ?? sourceMetadata?.fetchedAt);
  const records = [];
  const rejectedRecords = [];
  const seenIds = new Set();
  entries.forEach(({ food, inferredDataType }, index) => {
    const proposedId = Number.isInteger(food?.fdcId) ? `fdc:${food.fdcId}` : null;
    try {
      const record = toFdcRecord(food, inferredDataType, importedAt, sourceMetadata);
      if (seenIds.has(record.sourceId)) throw new Error(`Duplicate source identifier ${record.sourceId} in input batch.`);
      seenIds.add(record.sourceId);
      records.push(record);
    } catch (error) {
      rejectedRecords.push(rejectRecord(proposedId, index, error, food));
    }
  });
  const versions = [...new Set(records.map((record) => record.source.sourceVersion))].sort();
  const sourceVersion = versions.length ? versions.join(';') : 'not-reported';
  const declaredVersion = typeof sourceMetadata?.sourceVersion === 'string' && sourceMetadata.sourceVersion.trim()
    ? sourceMetadata.sourceVersion.trim()
    : sourceVersion;
  return finalizeBatch('fdc', declaredVersion, records, rejectedRecords, importedAt, sourceMetadata);
}

/** Backwards-compatible helper for existing staging callers expecting records. */
export function stageFdcFoods(payload, options) {
  return prepareFdcImport(payload, options).records;
}

function normalizeOffProduct(product, importedAt) {
  if (!product || typeof product !== 'object' || Array.isArray(product)) throw new Error('OFF product must be an object.');
  const barcode = String(product.code ?? product._id ?? '').trim();
  if (!barcode) throw new Error('OFF product is missing a stable barcode identifier.');
  const contentHash = sha256(stableJson(product));
  return {
    stagingSchemaVersion: 2,
    sourceId: `off:${barcode}`,
    source: {
      name: SOURCE_DEFINITIONS.off.name,
      sourceId: barcode,
      barcode,
      retrievedAt: importedAt,
      license: SOURCE_DEFINITIONS.off.license,
      sourceUrl: `https://world.openfoodfacts.org/product/${encodeURIComponent(barcode)}`,
      revision: product.rev ?? null,
      lastModifiedAt: product.last_modified_t ?? null,
    },
    productName: typeof product.product_name === 'string' ? product.product_name : null,
    brands: typeof product.brands === 'string' ? product.brands : null,
    ingredientsText: typeof product.ingredients_text === 'string' ? product.ingredients_text : null,
    allergens: Array.isArray(product.allergens_tags) ? product.allergens_tags : [],
    labelNutrition: product.nutriments && typeof product.nutriments === 'object' ? product.nutriments : null,
    nutritionBasis: {
      target: 'package_label_as_reported',
      sourceBasis: product.nutriments ? 'per_100g_or_serving_keys_preserved' : null,
      verificationStatus: 'pending_label_review',
    },
    quantity: typeof product.quantity === 'string' ? product.quantity : null,
    foodState: null,
    foodStateVerificationStatus: 'pending_product_state_review',
    contentHash,
    eligibleForProduction: false,
    verificationStatus: 'pending_identity_label_and_license_review',
  };
}

/** Stage branded products separately; do not map labels into generic composition records. */
export function prepareOpenFoodFactsImport(payload, { importedAt: importedAtValue } = {}) {
  const products = Array.isArray(payload) ? payload : payload?.products;
  if (!Array.isArray(products)) throw new Error('Open Food Facts input must contain a products array.');
  const importedAt = validTimestamp(importedAtValue);
  const records = [];
  const rejectedRecords = [];
  const seenIds = new Set();
  products.forEach((product, index) => {
    const barcode = product?.code ?? product?._id;
    const proposedId = barcode ? `off:${String(barcode)}` : null;
    try {
      const record = normalizeOffProduct(product, importedAt);
      if (seenIds.has(record.sourceId)) throw new Error(`Duplicate source identifier ${record.sourceId} in input batch.`);
      seenIds.add(record.sourceId);
      records.push(record);
    } catch (error) {
      rejectedRecords.push(rejectRecord(proposedId, index, error, product));
    }
  });
  const revisions = [...new Set(records.map((record) => String(record.source.revision ?? 'not-reported')))].sort();
  return finalizeBatch('off', revisions.join(';') || 'not-reported', records, rejectedRecords, importedAt);
}

/** Backwards-compatible helper for existing staging callers expecting records. */
export function stageOpenFoodFactsProducts(payload, options) {
  return prepareOpenFoodFactsImport(payload, options).records;
}

export function validateStagingBatch(batch) {
  const errors = [];
  if (!batch || typeof batch !== 'object' || Array.isArray(batch)) return { valid: false, errors: ['Batch must be an object.'] };
  if (batch.schemaVersion !== 2) errors.push('Unsupported staging batch schema version.');
  if (!['fdc', 'off'].includes(batch.source)) errors.push('Unknown staging source.');
  if (!/^[-a-z0-9]{20,40}$/.test(batch.batchId ?? '')) errors.push('Batch ID is not stable-format.');
  if (typeof batch.sourceVersion !== 'string' || !batch.sourceVersion.trim()) errors.push('Source version must be a non-empty string.');
  if (Number.isNaN(Date.parse(batch.importedAt))) errors.push('Batch import timestamp must be valid.');
  if (batch.reviewStatus !== 'staging_review_required') errors.push('Every batch must require staging review.');
  if (!Array.isArray(batch.records) || !Array.isArray(batch.rejectedRecords)) errors.push('Batch must include records and rejectedRecords arrays.');
  if (batch.productionImport !== false) errors.push('Staging batches cannot enable production imports.');
  if (batch.recordCount !== batch.records?.length) errors.push('recordCount does not match records.');
  if (batch.rejectedRecordCount !== batch.rejectedRecords?.length) errors.push('rejectedRecordCount does not match rejectedRecords.');
  if (batch.source === 'off' && batch.records?.some((record) => record.nutrients !== undefined)) {
    errors.push('Open Food Facts package labels must remain separate from generic nutrients.');
  }
  const seen = new Set();
  for (const record of batch.records ?? []) {
    if (!record || record.batchId !== batch.batchId || record.eligibleForProduction !== false) {
      errors.push('Every staged record must belong to this batch and remain production-ineligible.');
    }
    const sourcePrefix = batch.source === 'fdc' ? 'fdc:' : 'off:';
    if (!record?.sourceId?.startsWith(sourcePrefix) || seen.has(record.sourceId)) errors.push('Staged source identifiers must be present, namespaced, and unique.');
    seen.add(record?.sourceId);
    if (!record?.source?.name || !record.source.license || !record.source.sourceId) errors.push('Source name, license, and stable source ID are required.');
    if (!record?.nutritionBasis || !Object.hasOwn(record.nutritionBasis, 'sourceBasis')) errors.push('Nutrition basis and its verification state must be explicit.');
    if (record?.foodState !== null && !ALLOWED_FOOD_STATES.has(record.foodState)) errors.push('Food state must be null or a reviewed raw/cooked/dried/fresh/processed state.');
    if (record?.foodState === null && !String(record.foodStateVerificationStatus ?? '').startsWith('pending')) errors.push('Unknown food state must remain explicitly unverified.');
    if (Array.isArray(record?.nutrients) && record.nutrients.some(({ amount }) => amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0))) {
      errors.push('Nutrient amounts must be non-negative numbers or null.');
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateReviewedFoodState(value) {
  return value === null || ALLOWED_FOOD_STATES.has(value);
}
