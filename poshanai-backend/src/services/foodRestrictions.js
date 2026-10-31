const aliasGroups = [
  ['egg', 'eggs'],
  ['dairy', 'milk', 'curd', 'dahi', 'yogurt', 'yoghurt', 'paneer', 'cheese', 'butter', 'ghee'],
  ['peanut', 'peanuts', 'groundnut', 'groundnuts'],
  ['nuts', 'nut', 'almond', 'almonds', 'cashew', 'cashews', 'pistachio', 'pistachios', 'walnut', 'walnuts'],
  ['soy', 'soya', 'soybean', 'soybeans', 'soya bean', 'soya beans', 'soy chunks', 'soya chunks'],
  ['gluten', 'wheat', 'atta', 'roti', 'chapati', 'phulka', 'maida', 'barley'],
  ['legume', 'legumes', 'pulse', 'pulses', 'dal', 'dahl', 'lentil', 'lentils', 'chana', 'chickpea', 'chickpeas', 'rajma', 'beans'],
  ['fish', 'fishes'],
  ['shellfish', 'prawn', 'prawns', 'shrimp', 'shrimp(s)', 'crab', 'lobster'],
  ['poultry', 'chicken', 'turkey'],
  ['mushroom', 'mushrooms'],
  ['sesame', 'til'],
  ['seeds', 'seed', 'sunflower seed', 'pumpkin seed'],
  ['onion', 'onions', 'pyaaz', 'pyaz'],
  ['tomato', 'tomatoes'],
  ['potato', 'potatoes', 'aloo'],
  ['cauliflower', 'gobhi', 'gobi'],
  ['spinach', 'palak'],
  ['okra', 'lady finger', 'ladies finger', 'bhindi'],
];

const normalize = (value) => String(value ?? '').toLocaleLowerCase('en')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const aliasToConcept = new Map();
for (const [concept, ...aliases] of aliasGroups) {
  for (const alias of [concept, ...aliases]) aliasToConcept.set(normalize(alias), concept);
}

function conceptsFor(value) {
  const normalized = normalize(value);
  if (!normalized) return new Set();
  const exact = aliasToConcept.get(normalized);
  if (exact) return new Set([exact]);
  return new Set(normalized.split(' ').map((part) => aliasToConcept.get(part)).filter(Boolean));
}

function foodConcepts(food) {
  return new Set([
    food?.foodName,
    food?.householdName,
    food?.category,
    ...(Array.isArray(food?.allergens) ? food.allergens : []),
  ].flatMap((value) => [...conceptsFor(value)]));
}

export function foodMatchesRestriction(restriction, food) {
  const blockedConcepts = conceptsFor(restriction);
  if (!blockedConcepts.size) return normalize(food?.foodName).includes(normalize(restriction));
  const candidateConcepts = foodConcepts(food);
  return [...blockedConcepts].some((concept) => candidateConcepts.has(concept));
}

export function foodMatchesAnyRestriction(restrictions = [], food) {
  return restrictions.some((restriction) => foodMatchesRestriction(restriction, food));
}

export function normalizeFoodRestriction(value) {
  return aliasToConcept.get(normalize(value)) ?? normalize(value);
}

export default { foodMatchesRestriction, foodMatchesAnyRestriction, normalizeFoodRestriction };
