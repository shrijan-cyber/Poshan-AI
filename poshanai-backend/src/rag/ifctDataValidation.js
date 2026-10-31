import { createHash } from 'node:crypto';

export const IFCT_NUTRIENT_FIELDS = Object.freeze([
  'calories', 'protein', 'carbs', 'fat', 'iron', 'calcium', 'vitaminD', 'vitaminB12', 'fiber',
]);

export const IFCT_DATA_STATUSES = Object.freeze([
  'analytical', 'derived', 'label_reported', 'estimated', 'missing',
]);

const codePattern = /^[A-Z]\d{3}$/;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function validateIfctManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['Manifest must be a JSON object.'] };
  }
  if (manifest.manifestVersion !== 1) errors.push('manifestVersion must be 1.');
  if (!manifest.dataset?.name) errors.push('dataset.name is required.');
  if (!manifest.dataset?.source?.url) errors.push('dataset.source.url is required.');
  if (!Number.isInteger(manifest.dataset?.recordCount) || manifest.dataset.recordCount < 1) {
    errors.push('dataset.recordCount must be a positive integer.');
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.dataset?.sha256 ?? '')) errors.push('dataset.sha256 must be a SHA-256 hex digest.');
  if (!manifest.nutrientBasis?.value) errors.push('nutrientBasis.value must be explicit.');
  for (const field of IFCT_NUTRIENT_FIELDS) {
    const metadata = manifest.nutrientFields?.[field];
    if (!metadata) {
      errors.push(`nutrientFields.${field} metadata is required.`);
      continue;
    }
    if (!IFCT_DATA_STATUSES.includes(metadata.dataStatus) && metadata.dataStatus !== 'unknown') {
      errors.push(`nutrientFields.${field}.dataStatus is not recognized.`);
    }
    if (metadata.mappingStatus === 'unverified' && metadata.sourceUnit !== null) {
      errors.push(`nutrientFields.${field}.sourceUnit must be null while mapping is unverified.`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Inspect source records without changing values or converting missing data to zero. */
export function auditIfctFoods(foods, manifest = null) {
  const errors = [];
  const warnings = [];
  const seenCodes = new Set();
  const codesByName = new Map();
  const missingCounts = Object.fromEntries(IFCT_NUTRIENT_FIELDS.map((field) => [field, 0]));
  const suspiciousEnergyCodes = [];
  let uniqueCodeCount = 0;

  if (!Array.isArray(foods)) {
    return {
      valid: false,
      recordCount: 0,
      uniqueCodeCount: 0,
      missingCounts,
      suspiciousEnergyCodes,
      duplicateNameGroups: [],
      errors: ['IFCT records must be an array.'],
      warnings,
    };
  }

  for (const [index, food] of foods.entries()) {
    if (!food || typeof food !== 'object' || Array.isArray(food)) {
      errors.push(`Record ${index} must be an object.`);
      continue;
    }
    if (typeof food.ifctCode !== 'string' || !codePattern.test(food.ifctCode)) {
      errors.push(`Record ${index} has an invalid IFCT code.`);
    } else if (seenCodes.has(food.ifctCode)) {
      errors.push(`Duplicate IFCT code ${food.ifctCode}.`);
    } else {
      seenCodes.add(food.ifctCode);
      uniqueCodeCount += 1;
    }
    if (typeof food.foodName !== 'string' || !food.foodName.trim()) {
      errors.push(`Record ${food.ifctCode ?? index} has no food name.`);
    } else {
      const normalizedName = food.foodName.trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
      const codes = codesByName.get(normalizedName) ?? [];
      codes.push(food.ifctCode);
      codesByName.set(normalizedName, codes);
    }
    if (!food.nutrients || typeof food.nutrients !== 'object' || Array.isArray(food.nutrients)) {
      errors.push(`Record ${food.ifctCode ?? index} has no nutrient object.`);
      continue;
    }

    for (const field of IFCT_NUTRIENT_FIELDS) {
      if (!Object.hasOwn(food.nutrients, field)) {
        errors.push(`Record ${food.ifctCode ?? index} is missing nutrient field ${field}.`);
        continue;
      }
      const value = food.nutrients[field];
      if (value === null) {
        missingCounts[field] += 1;
      } else if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        errors.push(`Record ${food.ifctCode ?? index} has an invalid ${field} value.`);
      }
    }

    const energy = food.nutrients.calories;
    const fat = food.nutrients.fat;
    if (energy === 0 && typeof fat === 'number' && fat > 0) suspiciousEnergyCodes.push(food.ifctCode);

    if (typeof energy === 'number' && energy > 0
      && ['protein', 'carbs', 'fat'].every((field) => Number.isFinite(food.nutrients[field]))) {
      const macroEnergy = (food.nutrients.protein * 4)
        + (food.nutrients.carbs * 4)
        + (food.nutrients.fat * 9);
      if (Math.abs(macroEnergy - energy) / energy > 0.25) {
        warnings.push({ code: 'ENERGY_MACRO_MISMATCH', ifctCode: food.ifctCode });
      }
    }
  }

  if (suspiciousEnergyCodes.length) {
    warnings.push({ code: 'ENERGY_ZERO_WITH_POSITIVE_FAT', ifctCodes: suspiciousEnergyCodes });
  }
  const duplicateNameGroups = [...codesByName.entries()]
    .filter(([, codes]) => codes.length > 1)
    .map(([foodName, ifctCodes]) => ({ foodName, ifctCodes }));
  if (duplicateNameGroups.length) warnings.push({ code: 'DUPLICATE_NORMALIZED_FOOD_NAMES', groups: duplicateNameGroups });
  if (Number.isInteger(manifest?.dataset?.officialReportedFoodCount)
    && foods.length !== manifest.dataset.officialReportedFoodCount) {
    warnings.push({
      code: 'RECORD_COUNT_DIFFERS_FROM_SOURCE_PUBLICATION',
      applicationRecordCount: foods.length,
      publishedRecordCount: manifest.dataset.officialReportedFoodCount,
    });
  }
  if (manifest?.dataset?.source?.sourceColumnMappingVerified !== true) {
    warnings.push({ code: 'SOURCE_COLUMN_MAPPING_UNVERIFIED' });
  }
  if (foods.some((food) => food && !food.sourceReference)) {
    warnings.push({ code: 'RECORD_LEVEL_SOURCE_LOCATOR_UNAVAILABLE' });
  }

  return {
    valid: errors.length === 0,
    recordCount: foods.length,
    uniqueCodeCount,
    missingCounts,
    suspiciousEnergyCodes,
    duplicateNameGroups,
    errors,
    warnings,
  };
}

export function validateDatasetChecksum(content, expectedSha256) {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256 ?? '')) {
    return { valid: false, actualSha256: sha256(content), error: 'Expected SHA-256 checksum is unavailable or invalid.' };
  }
  const actualSha256 = sha256(content);
  return {
    valid: actualSha256.toLowerCase() === expectedSha256.toLowerCase(),
    actualSha256,
    error: actualSha256.toLowerCase() === expectedSha256.toLowerCase() ? null : 'SHA-256 checksum does not match.',
  };
}
