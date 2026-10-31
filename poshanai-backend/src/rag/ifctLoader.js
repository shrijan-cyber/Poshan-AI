import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const datasetPath = path.resolve(__dirname, '../../data/ifct_2017.json');
let cachedFoods;

const blockedEverydayAlternatives = /\b(?:barley)\b/i;
const explicitlyRequestedOnly = /\b(?:amaranth|agathi|ragi|quinoa)\b/i;
const commonHouseholdFood = new RegExp([
  '^rice (?:flakes|puffed)$',
  '^rice, (?:raw, brown|parboiled, milled|raw, milled)$',
  '^wheat flour, (?:refined|atta)$',
  '^wheat, (?:whole|semolina|vermicelli(?:, roasted)?)$',
  '^maize, tender, (?:local|sweet)$',
  '^(?:bengal gram, (?:dal|whole)|black gram, (?:dal|whole)|green gram, (?:dal|whole)|red gram, (?:dal|whole)|lentil (?:dal|whole, brown|whole, yellowish)|peas, dry|rajmah, (?:black|brown|red)|soya bean, (?:brown|white))$',
  '^(?:cabbage, green|cauliflower|drumstick leaves|fenugreek leaves|mustard leaves|spinach)$',
  '^(?:bitter gourd, .+|bottle gourd, .+|brinjal - all varieties|capsicum, green|cluster beans|cucumber, green, (?:elongate|short)|drumstick|french beans, (?:country|hybrid)|ladies finger|peas, fresh|plantain, green|pumpkin, (?:green, cylindrical|orange, round)|ridge gourd(?:, smooth skin)?|tomato, (?:ripe, hybrid|ripe, local))$',
  '^(?:apple, (?:big|small)|banana, ripe, (?:montham|poovam|red|robusta)|guava, (?:white|pink) flesh|lemon, juice|mango, ripe, .+|orange, pulp|papaya, ripe|pomegranate, maroon seeds|water melon, .+)$',
  '^(?:beet root|carrot, (?:orange|red)|potato, (?:brown skin, (?:big|small)|red skin)|radish, .+|sweet potato, .+|tapioca|yam, ordinary)$',
  '^(?:garlic, (?:big|small) clove|ginger, fresh|onion, (?:big|small)|chillies, green - all varieties|coriander leaves|curry leaves|turmeric powder|cumin seeds)$',
  '^milk, whole, (?:buffalo|cow)$',
  '^paneer$',
  '^egg, poultry, whole, (?:raw|boiled)$',
  '^chicken, poultry, (?:leg|thigh|breast), skinless$',
  '^(?:anchovy|betki|bombay duck|hilsa|karimeen|mackerel|pomfret, (?:black|snub nose|white)|sardine|tilapia|vanjaram|catla|rohu)$',
].join('|'), 'i');

const householdNameRules = [
  [/\bTriticum aestivum\b/i, 'Wheat Roti'],
  [/^Rice flakes$/i, 'Poha'],
  [/^Rice puffed$/i, 'Puffed rice (murmura)'],
  [/^Rice,/i, 'Rice'],
  [/^Wheat flour, atta$/i, 'Wheat Roti'],
  [/^Wheat flour, refined$/i, 'Wheat flour'],
  [/^Wheat, whole$/i, 'Whole wheat (for roti)'],
  [/^Wheat,/i, 'Wheat staple'],
  [/^Bengal gram, dal$/i, 'Chana dal'],
  [/^Bengal gram, whole$/i, 'Whole chana'],
  [/^Black gram, dal$/i, 'Urad dal'],
  [/^Green gram, dal$/i, 'Moong dal'],
  [/^Red gram, dal$/i, 'Toor dal'],
  [/^Lentil dal$/i, 'Masoor dal'],
  [/^Rajmah,/i, 'Rajma'],
  [/^Soya bean,/i, 'Soybeans'],
  [/^Bottle gourd,/i, 'Lauki'],
  [/^Ladies finger$/i, 'Bhindi'],
  [/^Cauliflower$/i, 'Gobhi'],
  [/^Spinach$/i, 'Palak'],
  [/^Tomato,/i, 'Tomato'],
  [/^Onion,/i, 'Pyaaz'],
  [/^Potato,/i, 'Aloo'],
  [/^Milk,/i, 'Milk'],
  [/^Egg,/i, 'Eggs'],
  [/^Chicken,/i, 'Chicken'],
];

export function getHouseholdFoodName(food) {
  const rule = householdNameRules.find(([pattern]) => pattern.test(food.foodName));
  return rule?.[1] ?? food.foodName;
}

export function wasFoodExplicitlyRequested(food, requestText = '') {
  const text = String(requestText).toLowerCase();
  const names = [food.foodName, getHouseholdFoodName(food), String(food.foodName ?? '').split(/[\s,]+/)[0]];
  for (const name of names) {
    const normalizedName = String(name).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(`\\b${normalizedName}\\b`, 'i');
    const match = expression.exec(text);
    if (!match) continue;
    const before = text.slice(Math.max(0, match.index - 60), match.index);
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 24);
    if (/\b(?:do not|don't|dont|avoid|exclude|never|without|no)\b/i.test(before)
      || /^\s*(?:is not|isn't|not|never|please avoid)\b/i.test(after)) continue;
    return true;
  }
  return false;
}

function isCommonHouseholdFood(food) {
  const name = String(food.foodName ?? '').trim();
  return commonHouseholdFood.test(name)
    && !blockedEverydayAlternatives.test(name)
    && !explicitlyRequestedOnly.test(name);
}

export function getHouseholdFoodWhitelist(foods, requestText = '', limit = 100) {
  const requested = foods.filter((food) => wasFoodExplicitlyRequested(food, requestText));
  const common = foods.filter(isCommonHouseholdFood);
  const preferredCodes = [
    'A011', 'A012', 'A014', 'A015', 'A019', 'B001', 'B003', 'B010', 'B013', 'B018', 'B020', 'B021',
    'D031', 'D036', 'D056', 'D007', 'D076', 'C033', 'F006', 'F007', 'G017', 'L003', 'M004', 'N003',
  ];
  const rank = (food) => {
    const index = preferredCodes.indexOf(food.ifctCode);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  const curated = common
    .slice()
    .sort((a, b) => rank(a) - rank(b) || a.ifctCode.localeCompare(b.ifctCode))
    .slice(0, Math.max(1, Math.min(100, limit)));
  const byCode = new Map([...curated, ...requested].map((food) => [food.ifctCode, food]));
  return [...byCode.values()];
}

export function loadIfctDataset(filePath = datasetPath) {
  const foods = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(foods) || foods.length === 0) {
    throw new Error(`IFCT dataset must be a non-empty array: ${filePath}`);
  }

  return foods.map((food) => ({
    ...food,
    nutrients: {
      ...food.nutrients,
      // The original IFCT build encoded missing oil energy as 0 despite 100 g fat.
      calories: food.nutrients?.calories === 0 && food.nutrients?.fat > 0
        ? null
        : food.nutrients?.calories,
    },
  }));
}

/** Load the catalog once so every backend service shares identical IFCT records. */
export function getIfctFoods() {
  if (!cachedFoods) {
    cachedFoods = loadIfctDataset();
    for (const food of cachedFoods) {
      if (food.nutrients && !Object.isFrozen(food.nutrients)) Object.freeze(food.nutrients);
      Object.freeze(food);
    }
    Object.freeze(cachedFoods);
  }
  return cachedFoods;
}

const foodNameKey = (value) => String(value ?? '').toLocaleLowerCase('en')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const safeFoodSubstitutions = new Map([
  ['dahi', 'milk, whole, cow'],
  ['curd', 'milk, whole, cow'],
  ['yogurt', 'milk, whole, cow'],
  ['yoghurt', 'milk, whole, cow'],
  ['chole', 'bengal gram, whole'],
  ['chickpeas', 'bengal gram, whole'],
]);

/** Resolve names only to real catalog records; substitutions are explicit and reported. */
export function resolveIfctFoodReference(name, foods = getIfctFoods()) {
  const requestedName = String(name ?? '').trim();
  const key = foodNameKey(requestedName);
  if (!key) return { requestedName, food: null, substituted: false, warning: 'Food name is empty.' };

  const exact = foods.find((food) => foodNameKey(food.foodName) === key
    || foodNameKey(getHouseholdFoodName(food)) === key);
  if (exact) return { requestedName, food: exact, substituted: false, warning: null };

  const substituteName = safeFoodSubstitutions.get(key);
  const substituteKey = foodNameKey(substituteName);
  const food = substituteName
    ? foods.find((candidate) => foodNameKey(candidate.foodName) === substituteKey)
    : null;
  if (food) {
    return {
      requestedName,
      food,
      substituted: true,
      warning: `No IFCT record for ${requestedName}; ${getHouseholdFoodName(food)} is an available catalog substitute.`,
    };
  }
  return {
    requestedName,
    food: null,
    substituted: false,
    warning: `No IFCT record is available for ${requestedName}; nutrient values were not estimated.`,
  };
}

export default {
  loadIfctDataset,
  getIfctFoods,
  getHouseholdFoodName,
  getHouseholdFoodWhitelist,
  wasFoodExplicitlyRequested,
  resolveIfctFoodReference,
};
