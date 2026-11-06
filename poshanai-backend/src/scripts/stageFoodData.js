import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { prepareFdcImport, prepareOpenFoodFactsImport, validateStagingBatch } from '../services/foodDataStaging.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const stagingDir = path.resolve(scriptDir, '../../data/staging');

export function writeBatchIdempotently(outputPath, batch) {
  const contents = `${JSON.stringify(batch, null, 2)}\n`;
  try {
    fs.writeFileSync(outputPath, contents, { flag: 'wx' });
    return 'created';
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let existing;
    try {
      existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    } catch {
      throw new Error(`Staging output already exists and is not a readable batch: ${outputPath}`);
    }
    if (existing.batchId === batch.batchId) return 'already-staged';
    throw new Error(`Refusing to overwrite an existing staging file with different source content: ${outputPath}`);
  }
}

function run([source, inputPath, outputName]) {
  if (!['fdc', 'off'].includes(source) || !inputPath || !/^[a-z0-9][a-z0-9._-]*\.json$/i.test(outputName ?? '')) {
    throw new Error('Usage: node src/scripts/stageFoodData.js <fdc|off> <downloaded-json-path> <staging-filename.json>');
  }
  const input = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
  const batch = source === 'fdc' ? prepareFdcImport(input) : prepareOpenFoodFactsImport(input);
  const validation = validateStagingBatch(batch);
  if (!validation.valid) throw new Error(`Staging batch failed validation: ${validation.errors.join(' ')}`);

  fs.mkdirSync(stagingDir, { recursive: true });
  const outputPath = path.join(stagingDir, outputName);
  const writeStatus = writeBatchIdempotently(outputPath, batch);
  process.stdout.write(
    `${writeStatus === 'created' ? 'Staged' : 'Already staged'} ${batch.recordCount} ${source.toUpperCase()} records; `
    + `${batch.rejectedRecordCount} rejected; batch ${batch.batchId}; output ${outputPath}. `
    + 'No production catalog was changed.\n',
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
