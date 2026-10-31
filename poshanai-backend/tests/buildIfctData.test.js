import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildIfctDataset,
  buildIfctRecords,
  convertNutrientValue,
  parseCsv,
  parseNumericValue,
  serializeIfctRecords,
} from '../src/scripts/buildIfctData.js';
import { sha256 } from '../src/rag/ifctDataValidation.js';

const csv = '\uFEFFCode,Name,Group,Region,Energy,Protein,Carbs,Fat,Iron,Calcium,Vitamin D,B12,Fibre\n'
  + 'A001,"Rice, raw",Cereals,1,418,7,78,1,2,10,0.1,,\n'
  + 'A002,"Food ""quoted""",Pulses,2,0,0,0,0,0,0,0,,\n';
const mapping = {
  sourceSha256: sha256(csv),
  expectedRecordCount: 2,
  columns: {
    ifctCode: 'Code', foodName: 'Name', category: 'Group', regionCode: 'Region',
    calories: 'Energy', protein: 'Protein', carbs: 'Carbs', fat: 'Fat', iron: 'Iron', calcium: 'Calcium',
    vitaminD: 'Vitamin D', vitaminB12: 'B12', fiber: 'Fibre',
  },
  units: {
    calories: 'kJ', protein: 'g', carbs: 'g', fat: 'g', iron: 'mg', calcium: 'mg', vitaminD: 'mg',
    vitaminB12: 'µg', fiber: 'g',
  },
};

test('CSV parser handles BOM, quoted commas, escaped quotes, and rejects unclosed quotes', () => {
  assert.deepEqual(parseCsv(csv)[1].slice(0, 2), ['A001', 'Rice, raw']);
  assert.equal(parseCsv(csv)[2][1], 'Food "quoted"');
  assert.throws(() => parseCsv('Code,Name\nA001,"broken'), /unterminated quoted field/);
});

test('named source columns, units, nulls, zero values and record counts are enforced', () => {
  const records = buildIfctRecords(csv, mapping);
  assert.equal(records[0].ifctCode, 'A001');
  assert.equal(records[0].nutrients.calories, 100);
  assert.equal(records[0].nutrients.protein, 7);
  assert.equal(records[0].nutrients.vitaminB12, null);
  assert.equal(records[0].nutrients.fiber, null);
  assert.equal(records[1].nutrients.calories, 0);
  assert.equal(records[0].foodName, 'Rice, raw');
  assert.equal(serializeIfctRecords(records), serializeIfctRecords(buildIfctRecords(csv, mapping)));
  assert.throws(() => buildIfctRecords(csv, { ...mapping, columns: { ...mapping.columns, protein: 'Protein Missing' } }), /header is missing/);
  assert.throws(() => buildIfctRecords(csv, { ...mapping, units: { ...mapping.units, protein: undefined } }), /source unit for protein is required/);
  assert.throws(() => buildIfctRecords(csv, { ...mapping, expectedRecordCount: 3 }), /record count mismatch/);
  assert.throws(() => buildIfctRecords(csv.replace('A002,', 'A001,'), mapping), /Duplicate IFCT code A001/);
});

test('numeric parsing and unit conversion preserve null/zero and reject unsupported assumptions', () => {
  assert.equal(parseNumericValue(''), null);
  assert.equal(parseNumericValue('0'), 0);
  assert.throws(() => parseNumericValue('trace'), /finite numeric value/);
  assert.equal(convertNutrientValue(418, 'kJ', 'kcal', 'calories'), 100);
  assert.equal(convertNutrientValue(0.004, 'g', 'mg', 'iron'), 4);
  assert.equal(convertNutrientValue(null, null, 'mg', 'iron'), null);
  assert.throws(() => convertNutrientValue(1, null, 'mg', 'iron'), /explicit source and target units/);
  assert.throws(() => convertNutrientValue(1, 'IU', 'µg', 'vitaminD'), /Unsupported/);
});

test('dataset build refuses absent source and protects runtime data from overwrite', async (t) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'poshanai-ifct-build-'));
  t.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));
  const absent = path.join(temporaryDirectory, 'missing.csv');
  await assert.rejects(buildIfctDataset({ sourcePath: absent }), /source CSV is unavailable/);

  const sourcePath = path.join(temporaryDirectory, 'source.csv');
  const mappingPath = path.join(temporaryDirectory, 'mapping.json');
  fs.writeFileSync(sourcePath, csv);
  fs.writeFileSync(mappingPath, JSON.stringify(mapping));
  await assert.rejects(
    buildIfctDataset({ sourcePath, mappingPath, outputPath: sourcePath, runtimeDatasetPath: path.join(temporaryDirectory, 'runtime.json') }),
    /Refusing to overwrite/,
  );
  await assert.rejects(
    buildIfctDataset({ sourcePath, mappingPath, outputPath: path.join(temporaryDirectory, 'output.json'), runtimeDatasetPath: path.join(temporaryDirectory, 'output.json') }),
    /Refusing to overwrite/,
  );

  const invalidMapping = { ...mapping, sourceSha256: '0'.repeat(64) };
  fs.writeFileSync(mappingPath, JSON.stringify(invalidMapping));
  await assert.rejects(
    buildIfctDataset({ sourcePath, mappingPath, outputPath: path.join(temporaryDirectory, 'output.json'), runtimeDatasetPath: path.join(temporaryDirectory, 'runtime.json') }),
    /checksum validation failed/,
  );
});
