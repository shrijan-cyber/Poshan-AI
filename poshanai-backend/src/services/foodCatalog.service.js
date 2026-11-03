import httpError from '../utils/httpError.js';
import { getIfctFoods, getIfctManifest } from '../rag/ifctLoader.js';

let foods = [];
try {
  foods = getIfctFoods();
} catch {
  // Fail closed through assertCatalogLoaded instead of serving invented records.
}

const foodsByCode = new Map(foods.map((food) => [food.ifctCode, food]));
const manifest = getIfctManifest();
const datasetSource = Object.freeze({
  dataset: manifest.dataset.name,
  name: manifest.dataset.source.name,
  version: manifest.dataset.source.version,
  referenceUrl: manifest.dataset.source.url,
  recordLevelMappingAvailable: Boolean(manifest.dataset.source.sourceColumnMappingVerified),
  foodStateAvailable: Boolean(manifest.foodState?.recordLevelStateAvailable),
});
export const hasCalorieData = (food) => Number(food?.nutrients?.calories) > 0;

// The IFCT build script writes 0 kcal when energy is missing (e.g. cooking oils). Those foods are
// kept out of search so they cannot silently under-count a diary; adding one is rejected too.
const searchIndex = foods
  .filter(hasCalorieData)
  .map((food) => ({ food, name: String(food.foodName).toLowerCase() }));

export const MIN_GRAMS = 1;
export const MAX_GRAMS = 2000;

const round1 = (value) => Math.round(value * 10) / 10;
/** Macro values per 100 g, as stored in the IFCT dataset. */
const nullableNumber = (value) => value === null || value === undefined || !Number.isFinite(Number(value))
  ? null
  : Number(value);

const hasUnresolvedEnergy = (nutrients) => nutrients?.calories === 0
  && Number.isFinite(nutrients?.fat)
  && nutrients.fat > 0;

function publicFood({ ifctCode, foodName, category, nutrients, servingUnits, source, provenance, foodState, preparationState }) {
  return {
    ifctCode,
    foodName,
    category,
    ...(servingUnits ? { servingUnits } : {}),
    source: source ?? provenance ?? datasetSource,
    ...(foodState || preparationState ? { foodState: foodState ?? preparationState } : {}),
    nutrients: {
      // Preserve the existing API contract: known-invalid oil energy is unavailable,
      // while the underlying IFCT source record remains unchanged at zero.
      calories: hasUnresolvedEnergy(nutrients) ? null : nullableNumber(nutrients?.calories),
      protein: nullableNumber(nutrients?.protein),
      carbs: nullableNumber(nutrients?.carbs),
      fat: nullableNumber(nutrients?.fat),
    },
  };
}

export function assertCatalogLoaded() {
  if (foods.length === 0) {
    throw httpError(503, 'FOOD_CATALOG_UNAVAILABLE', 'The food database is temporarily unavailable.');
  }
}

export function getFoodByCode(ifctCode) {
  const food = foodsByCode.get(ifctCode);
  return food ? publicFood(food) : null;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Case-insensitive search by food name. Every word typed must start a word in the name
 * ("oil" will not match "boiled"). Names whose first word is the query rank first, then names
 * that start with the query, then the rest.
 */
export function searchFoods(query, limit = 10, index = searchIndex) {
  const tokens = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const joined = tokens.join(' ');
  const wordStart = tokens.map((token) => new RegExp(`(^|[\\s,()/-])${escapeRegExp(token)}`));
  const firstWord = new RegExp(`^${escapeRegExp(tokens[0])}(?![a-z])`);

  const scored = [];
  for (const entry of index) {
    if (!wordStart.every((pattern) => pattern.test(entry.name))) continue;
    let score = 2;
    if (firstWord.test(entry.name)) score = 0;
    else if (entry.name.startsWith(joined)) score = 1;
    scored.push({ entry, score });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.entry.name.length - b.entry.name.length ||
      a.entry.name.localeCompare(b.entry.name) ||
      String(a.entry.food.ifctCode).localeCompare(String(b.entry.food.ifctCode)),
  );
  return scored.slice(0, limit).map(({ entry }) => publicFood(entry.food));
}

const normalized = (value) => String(value ?? '').trim().toLocaleLowerCase('en');
const recordSource = (food) => food.source ?? food.provenance ?? null;
const recordState = (food) => food.foodState ?? food.preparationState ?? food.rawCookedState ?? null;

/** Search the bounded static catalog and paginate after deterministic filtering. */
export function searchFoodPage(query, {
  page = 1,
  limit = 10,
  category,
  source,
  state,
} = {}) {
  const matchingFoods = searchFoods(query, Number.MAX_SAFE_INTEGER, searchIndex);
  const categories = [...new Set(matchingFoods.map((food) => food.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const filtered = matchingFoods.filter((food) => {
    if (category && normalized(food.category) !== normalized(category)) return false;
    if (source && normalized(recordSource(food)?.name ?? recordSource(food)) !== normalized(source)) return false;
    if (state && normalized(recordState(food)) !== normalized(state)) return false;
    return true;
  });
  const total = filtered.length;
  const pages = Math.ceil(total / limit);
  const safePage = Math.min(page, Math.max(pages, 1));
  const foodsOnPage = filtered.slice((safePage - 1) * limit, safePage * limit);

  return {
    foods: foodsOnPage,
    categories,
    pagination: { page: safePage, limit, total, pages },
  };
}

/** Scales per-100 g macros to a portion size. Nutrition values are always computed server-side. */
export function scaleNutrients(per100g, grams) {
  const factor = grams / 100;
  const scale = (value) => value === null || value === undefined || !Number.isFinite(Number(value))
    ? null
    : round1(Number(value) * factor);
  return {
    calories: scale(per100g.calories),
    protein: scale(per100g.protein),
    carbs: scale(per100g.carbs),
    fat: scale(per100g.fat),
  };
}

/** Scales all macros from IFCT per-100 g values to the final portion size. */
export function scaleFoodPortion(food, grams) {
  if (hasUnresolvedEnergy(food?.nutrients)) {
    throw httpError(422, 'IFCT_ENERGY_UNRESOLVED', 'This IFCT food has unresolved energy data and cannot be used for nutrition calculations.');
  }
  return scaleNutrients(food.nutrients, grams);
}

export function sumNutrients(entries) {
  const totals = entries.reduce(
    (sum, entry) => Object.fromEntries(['calories', 'protein', 'carbs', 'fat'].map((key) => [
      key,
      sum[key] === null || sum[key] === undefined
        || entry[key] === null || entry[key] === undefined
        || !Number.isFinite(Number(entry[key]))
        ? null
        : sum[key] + Number(entry[key]),
    ])),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const roundNullable = (value) => (value === null || value === undefined ? null : round1(value));
  return {
    calories: roundNullable(totals.calories),
    protein: roundNullable(totals.protein),
    carbs: roundNullable(totals.carbs),
    fat: roundNullable(totals.fat),
  };
}

export default { searchFoods, searchFoodPage, getFoodByCode, scaleFoodPortion, scaleNutrients, sumNutrients, assertCatalogLoaded };
