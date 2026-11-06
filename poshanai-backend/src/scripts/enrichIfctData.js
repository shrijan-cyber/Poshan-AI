import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const datasetPath = path.resolve(__dirname, '../../data/ifct_2017.json');
const TARGET_NUTRIENTS = ['protein', 'carbs', 'fiber', 'iron', 'calcium'];
const MACRONUTRIENTS = ['protein', 'carbs', 'fat'];

function readDataset() {
  const foods = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  if (!Array.isArray(foods) || foods.length === 0) {
    throw new Error(`IFCT dataset must be a non-empty array: ${datasetPath}`);
  }
  return foods;
}

function isMissing(value) {
  return value === null || value === undefined || value === 0;
}

function buildCategoryMeans(foods) {
  const sums = new Map();

  for (const food of foods) {
    const category = food.category?.trim();
    if (!category) continue;

    for (const nutrient of TARGET_NUTRIENTS) {
      // Do not treat prior imputed values as source data on repeated runs.
      if (food.nutrientImputations?.[nutrient]) continue;
      const value = food.nutrients?.[nutrient];
      if (!Number.isFinite(value) || value <= 0) continue;

      const key = `${category}\u0000${nutrient}`;
      const group = sums.get(key) ?? { sum: 0, count: 0 };
      group.sum += value;
      group.count += 1;
      sums.set(key, group);
    }
  }

  return sums;
}

export function enrichIfctFoods(foods) {
  const categoryMeans = buildCategoryMeans(foods);
  const report = Object.fromEntries(TARGET_NUTRIENTS.map((nutrient) => [
    nutrient,
    { candidates: 0, imputed: 0, unavailable: 0 },
  ]));

  const enriched = foods.map((food) => {
    const nutrients = { ...food.nutrients, fiber: food.nutrients?.fiber ?? null };
    const nutrientImputations = { ...food.nutrientImputations };

    for (const nutrient of TARGET_NUTRIENTS) {
      const value = nutrients[nutrient];
      if (!isMissing(value)) continue;

      report[nutrient].candidates += 1;
      const category = food.category?.trim();
      const donors = category ? categoryMeans.get(`${category}\u0000${nutrient}`) : undefined;

      if (!donors || donors.count === 0) {
        report[nutrient].unavailable += 1;
        continue;
      }

      nutrients[nutrient] = Math.round((donors.sum / donors.count) * 100) / 100;
      nutrientImputations[nutrient] = {
        method: 'same-category arithmetic mean',
        category,
        donorCount: donors.count,
        originalValue: value ?? null,
      };
      report[nutrient].imputed += 1;
    }

    return {
      ...food,
      nutrients,
      ...(Object.keys(nutrientImputations).length ? { nutrientImputations } : {}),
    };
  });

  return { foods: enriched, report };
}

export function validateMacronutrients(foods, limit = foods.length) {
  const checkedFoods = foods.slice(0, limit);
  const missing = [];

  for (const food of checkedFoods) {
    for (const nutrient of MACRONUTRIENTS) {
      if (!Number.isFinite(food.nutrients?.[nutrient])) {
        missing.push({ ifctCode: food.ifctCode, foodName: food.foodName, nutrient });
      }
    }
  }

  return { checked: checkedFoods.length, missing };
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const foods = readDataset();

  if (checkOnly) {
    const validation = validateMacronutrients(foods);
    console.log(`Checked ${validation.checked} IFCT records for null/non-numeric protein, carbs, and fat.`);
    if (validation.missing.length) {
      console.error(JSON.stringify(validation.missing, null, 2));
      process.exitCode = 1;
      return;
    }
    console.log('All catalog records have numeric macronutrient values.');
    const fiberCount = foods.filter((food) => Number.isFinite(food.nutrients?.fiber)).length;
    console.log(`Fiber has measured values for ${fiberCount}/${foods.length} records.`);
    return;
  }

  const { foods: enriched, report } = enrichIfctFoods(foods);
  const validation = validateMacronutrients(enriched);
  if (validation.missing.length) {
    throw new Error(`Refusing to write: ${validation.missing.length} records have missing macronutrients.`);
  }

  const temporaryPath = `${datasetPath}.${process.pid}.tmp`;
  const serialized = `${JSON.stringify(enriched, null, 2).replace(/\n/g, os.EOL)}${os.EOL}`;
  fs.writeFileSync(temporaryPath, serialized, 'utf8');
  fs.renameSync(temporaryPath, datasetPath);

  console.log(`Enriched ${enriched.length} IFCT records in ${datasetPath}.`);
  for (const nutrient of TARGET_NUTRIENTS) {
    const result = report[nutrient];
    console.log(`${nutrient}: ${result.imputed} imputed, ${result.unavailable} kept unavailable, ${result.candidates} missing/zero values found.`);
  }
  console.log(`Macronutrient validation passed for all ${validation.checked} catalog records.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
