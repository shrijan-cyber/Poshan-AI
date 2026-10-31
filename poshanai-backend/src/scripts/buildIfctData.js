import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, validateDatasetChecksum } from '../rag/ifctDataValidation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCE_CSV_PATH = path.resolve(__dirname, '../../package/index.csv');
const COLUMN_MAPPING_PATH = path.resolve(__dirname, '../data/ifct-source-columns.json');
const RUNTIME_DATASET_PATH = path.resolve(__dirname, '../../data/ifct_2017.json');
const GENERATED_DATASET_PATH = path.resolve(__dirname, '../../data/generated/ifct_2017.json');
export const BUILD_SCRIPT_VERSION = '1.0.0';

const REQUIRED_FIELDS = Object.freeze([
  'ifctCode', 'foodName', 'category', 'regionCode',
  'calories', 'protein', 'carbs', 'fat', 'iron', 'calcium', 'vitaminD',
]);
const OPTIONAL_NUTRIENTS = Object.freeze(['vitaminB12', 'fiber']);
const TARGET_UNITS = Object.freeze({
  calories: 'kcal', protein: 'g', carbs: 'g', fat: 'g', iron: 'mg', calcium: 'mg', vitaminD: 'µg',
  vitaminB12: 'µg', fiber: 'g',
});

// Existing app serving measures are kept separate from IFCT analytical values.
const SERVING_UNITS_BY_CODE = Object.freeze({
  A013: { bowl: 150, cup: 200, defaultUnit: 'cup' },
  A015: { bowl: 150, cup: 200, defaultUnit: 'cup' },
  E001: { small: 150, medium: 180, large: 220, defaultUnit: 'medium' },
  E002: { small: 150, medium: 180, large: 220, defaultUnit: 'medium' },
  E003: { small: 150, medium: 180, large: 220, defaultUnit: 'medium' },
  E004: { small: 150, medium: 180, large: 220, defaultUnit: 'medium' },
  E009: { small: 101, medium: 118, large: 136, defaultUnit: 'medium' },
  E010: { small: 101, medium: 118, large: 136, defaultUnit: 'medium' },
  E011: { small: 101, medium: 118, large: 136, defaultUnit: 'medium' },
  E012: { small: 101, medium: 118, large: 136, defaultUnit: 'medium' },
  M001: { small: 40, medium: 45, large: 50, defaultUnit: 'large' },
  M004: { small: 40, medium: 45, large: 50, defaultUnit: 'large' },
});

const normalizeUnit = (unit) => String(unit ?? '').trim().toLowerCase().replace(/μ/g, 'µ');

export function parseNumericValue(value, { field = 'value', allowNull = true } = {}) {
  const text = String(value ?? '').trim();
  if (!text) {
    if (allowNull) return null;
    throw new Error(`${field} is required and cannot be blank.`);
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
    throw new Error(`${field} must be a finite numeric value or an empty/null value.`);
  }
  const number = Number(text);
  if (!Number.isFinite(number)) throw new Error(`${field} must be finite.`);
  if (number < 0) throw new Error(`${field} cannot be negative.`);
  return number;
}

const gramsPerUnit = Object.freeze({ g: 1, gram: 1, grams: 1, mg: 1e-3, milligram: 1e-3, milligrams: 1e-3, 'µg': 1e-6, mcg: 1e-6, ug: 1e-6 });
const targetUnitsPerGram = Object.freeze({ g: 1, mg: 1000, 'µg': 1e6, mcg: 1e6, ug: 1e6 });

/** Convert only when both source and target units are explicitly supplied. */
export function convertNutrientValue(value, fromUnit, toUnit, field = 'nutrient') {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative finite number or null.`);
  }
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (!from || !to) throw new Error(`${field} requires explicit source and target units.`);
  if (from === to) return value;

  if (field === 'calories' && from === 'kj' && to === 'kcal') return Math.round((value / 4.18) * 100) / 100;
  if (field === 'calories' && from === 'kcal' && to === 'kj') return Math.round((value * 4.18) * 100) / 100;

  const sourceFactor = gramsPerUnit[from];
  const targetFactor = targetUnitsPerGram[to];
  if (sourceFactor && targetFactor) return value * sourceFactor * targetFactor;
  throw new Error(`Unsupported ${field} unit conversion: ${fromUnit} to ${toUnit}.`);
}

export function parseCsv(content) {
  const text = String(content ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('IFCT CSV contains an unterminated quoted field.');
  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  if (rows.length < 2) throw new Error('IFCT CSV must contain a header and at least one data row.');
  return rows;
}

function validateMapping(mapping, header) {
  if (!mapping || typeof mapping !== 'object') throw new Error('Verified IFCT column mapping is required.');
  if (!/^[a-f0-9]{64}$/i.test(mapping.sourceSha256 ?? '')) {
    throw new Error('Verified sourceSha256 is required in the IFCT column mapping.');
  }
  if (!Number.isInteger(mapping.expectedRecordCount) || mapping.expectedRecordCount < 1) {
    throw new Error('Verified expectedRecordCount is required in the IFCT column mapping.');
  }
  const headerIndex = new Map();
  header.forEach((name, index) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (headerIndex.has(trimmed)) throw new Error(`Duplicate CSV header: ${trimmed}.`);
    headerIndex.set(trimmed, index);
  });
  const columns = mapping.columns ?? {};
  const fields = [...REQUIRED_FIELDS, ...OPTIONAL_NUTRIENTS.filter((field) => columns[field] !== undefined)];
  for (const field of fields) {
    const headerName = columns[field];
    if (typeof headerName !== 'string' || !headerName.trim()) {
      throw new Error(`Verified CSV header mapping for ${field} is required.`);
    }
    if (!headerIndex.has(headerName.trim())) throw new Error(`Required IFCT CSV header is missing: ${headerName}.`);
    if (['calories', 'protein', 'carbs', 'fat', 'iron', 'calcium', 'vitaminD', ...OPTIONAL_NUTRIENTS].includes(field)) {
      const sourceUnit = mapping.units?.[field];
      if (typeof sourceUnit !== 'string' || !sourceUnit.trim()) {
        throw new Error(`Verified source unit for ${field} is required in the IFCT column mapping.`);
      }
    }
  }
  return { headerIndex, fields };
}

function derivedDietTags(category, foodName) {
  const group = category.toLowerCase();
  if (group.includes('egg')) return ['eggetarian', 'fishetarian', 'nonveg'];
  if (/fish|shellfish|mollusk/.test(group)) return ['fishetarian', 'nonveg'];
  if (/poultry|animal meat/.test(group)) return ['nonveg'];
  if (/grain legumes|pulses/.test(group) && /fish|meat|egg/i.test(foodName)) return ['nonveg'];
  return ['veg', 'eggetarian', 'fishetarian'];
}

function derivedAllergens(category, foodName) {
  const group = category.toLowerCase();
  const name = foodName.toLowerCase();
  const allergens = new Set();
  if (group.includes('grain legumes') || group.includes('pulses')) {
    allergens.add('legumes');
    if (/peanut/.test(name)) { allergens.add('peanuts'); allergens.add('nuts'); }
    if (/soy/.test(name)) allergens.add('soy');
  } else if (group.includes('milk')) allergens.add('dairy');
  else if (group.includes('egg')) allergens.add('eggs');
  else if (group.includes('poultry')) allergens.add('poultry');
  else if (group.includes('marine fish') || group.includes('fresh water fish')) allergens.add('fish');
  else if (group.includes('shellfish') || group.includes('mollusk')) allergens.add('shellfish');
  else if (group.includes('mushroom')) allergens.add('mushrooms');
  else if (group.includes('nuts and oil seeds')) {
    if (/walnut|almond|cashew|pista|hazelnut|pecan|nut/.test(name)) allergens.add('nuts');
    if (/sesame|til/.test(name)) { allergens.add('sesame'); allergens.add('seeds'); }
    if (/mustard|sunflower|flax|chia|pumpkin/.test(name)) allergens.add('seeds');
    if (!allergens.size) allergens.add('nuts');
  } else if (group.includes('cereals and millets') && /wheat|barley|rye|semolina|maida/.test(name)) {
    allergens.add('gluten');
  }
  return [...allergens];
}

export function buildIfctRecords(csvText, mapping) {
  const rows = parseCsv(csvText);
  const header = rows[0];
  const { headerIndex, fields } = validateMapping(mapping, header);
  const records = [];
  const seenCodes = new Set();

  for (const [offset, row] of rows.slice(1).entries()) {
    if (row.length !== header.length) throw new Error(`CSV row ${offset + 2} has ${row.length} cells; expected ${header.length}.`);
    const get = (field) => row[headerIndex.get(mapping.columns[field].trim())].trim();
    const ifctCode = get('ifctCode');
    if (!/^[A-Z]\d{3}$/.test(ifctCode)) throw new Error(`CSV row ${offset + 2} has invalid IFCT code ${ifctCode}.`);
    if (seenCodes.has(ifctCode)) throw new Error(`Duplicate IFCT code ${ifctCode} in CSV.`);
    seenCodes.add(ifctCode);

    const foodName = get('foodName');
    const category = get('category');
    if (!foodName) throw new Error(`CSV row ${offset + 2} has an empty food name.`);
    if (!category) throw new Error(`CSV row ${offset + 2} has an empty category.`);
    const regionCode = parseNumericValue(get('regionCode'), { field: `${ifctCode}.regionCode`, allowNull: false });
    if (!Number.isInteger(regionCode)) throw new Error(`${ifctCode}.regionCode must be an integer.`);

    const nutrients = {};
    for (const field of IFCT_NUTRIENT_FIELDS_FOR_BUILD) {
      if (!fields.includes(field)) {
        nutrients[field] = null;
        continue;
      }
      const rawValue = parseNumericValue(get(field), { field: `${ifctCode}.${field}` });
      nutrients[field] = convertNutrientValue(rawValue, mapping.units[field], TARGET_UNITS[field], field);
    }

    records.push({
      ifctCode,
      foodName,
      category,
      regionCode,
      dietTags: derivedDietTags(category, foodName),
      allergens: derivedAllergens(category, foodName),
      nutrients,
      ...(SERVING_UNITS_BY_CODE[ifctCode] ? { servingUnits: SERVING_UNITS_BY_CODE[ifctCode] } : {}),
    });
  }

  if (records.length !== mapping.expectedRecordCount) {
    throw new Error(`IFCT record count mismatch: expected ${mapping.expectedRecordCount}, found ${records.length}.`);
  }
  return records.sort((left, right) => left.ifctCode.localeCompare(right.ifctCode));
}

const IFCT_NUTRIENT_FIELDS_FOR_BUILD = Object.freeze([
  'calories', 'protein', 'carbs', 'fat', 'iron', 'calcium', 'vitaminD', 'vitaminB12', 'fiber',
]);

export function serializeIfctRecords(records) {
  return `${JSON.stringify(records, null, 2)}\n`;
}

export async function buildIfctDataset({
  sourcePath = SOURCE_CSV_PATH,
  mappingPath = COLUMN_MAPPING_PATH,
  outputPath = GENERATED_DATASET_PATH,
  runtimeDatasetPath = RUNTIME_DATASET_PATH,
} = {}) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Authorized IFCT source CSV is unavailable at ${sourcePath}. Supply the authorized source file; the checked-in application JSON is not a build source.`);
  }
  if (!fs.existsSync(mappingPath)) {
    throw new Error(`Verified IFCT header/unit mapping is unavailable at ${mappingPath}. Supply an explicit mapping after checking the original CSV headers and units.`);
  }
  const resolvedOutput = path.resolve(outputPath);
  if (resolvedOutput === path.resolve(sourcePath) || resolvedOutput === path.resolve(runtimeDatasetPath)) {
    throw new Error('Refusing to overwrite the source CSV or runtime IFCT dataset. Build output must be reviewed separately.');
  }

  const sourceContent = fs.readFileSync(sourcePath, 'utf8');
  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  const checksum = validateDatasetChecksum(sourceContent, mapping.sourceSha256);
  if (!checksum.valid) throw new Error(`IFCT source checksum validation failed: ${checksum.error}`);
  const records = buildIfctRecords(sourceContent, mapping);
  const output = serializeIfctRecords(records);
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  const temporaryPath = `${resolvedOutput}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, output, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temporaryPath, resolvedOutput);
  return { outputPath: resolvedOutput, recordCount: records.length, sourceSha256: sha256(sourceContent) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  buildIfctDataset()
    .then((result) => console.info(`Built ${result.recordCount} IFCT records at ${result.outputPath}; source SHA-256 ${result.sourceSha256}.`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
