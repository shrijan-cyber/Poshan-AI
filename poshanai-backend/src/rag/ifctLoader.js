import { readFile } from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_FIELDS = ['foodName'];
const verifiedIfctRecords = new WeakSet();

export const isVerifiedIfctRecord = (record) => Boolean(record && verifiedIfctRecords.has(record));

const parseCsvLine = (line) => {
  const values = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error('Malformed IFCT CSV: unterminated quoted value.');
  values.push(value.trim());
  return values;
};

const parseCsv = (contents) => {
  const lines = contents.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => Object.fromEntries(
    parseCsvLine(line).map((value, index) => [headers[index], value]),
  ));
};

const validateEntries = (entries) => {
  if (!Array.isArray(entries)) throw new TypeError('IFCT dataset must contain an array of food records.');
  return entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || REQUIRED_FIELDS.some((field) => !String(entry[field] ?? '').trim())) {
      throw new TypeError(`Invalid IFCT food record at index ${index}.`);
    }
    const verifiedRecord = Object.freeze({ ...entry, source: 'IFCT 2017' });
    verifiedIfctRecords.add(verifiedRecord);
    return verifiedRecord;
  });
};

export const loadIfctDataset = async (datasetPath) => {
  if (!datasetPath) throw new TypeError('Provide the path to a licensed, verified IFCT 2017 dataset.');
  const absolutePath = path.resolve(datasetPath);
  const extension = path.extname(absolutePath).toLowerCase();
  if (!['.json', '.csv'].includes(extension)) throw new TypeError('IFCT dataset must be JSON or CSV.');

  try {
    const contents = await readFile(absolutePath, 'utf8');
    const records = extension === '.json' ? JSON.parse(contents) : parseCsv(contents);
    return validateEntries(records);
  } catch (error) {
    throw new Error(`Unable to load IFCT dataset: ${error.message}`, { cause: error });
  }
};

export const searchIfctFoods = (foods, query, { limit = 10 } = {}) => {
  if (!Array.isArray(foods)) throw new TypeError('foods must be an array loaded from the verified IFCT dataset.');
  const terms = String(query ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return foods
    .filter((food) => terms.every((term) => JSON.stringify(food).toLowerCase().includes(term)))
    .slice(0, Math.max(0, limit));
};

// TODO: Add schema validation for the official IFCT 2017 distribution once its format is selected.
