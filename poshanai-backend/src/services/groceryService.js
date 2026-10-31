import { getFoodByCode } from './foodCatalog.service.js';
import { getHouseholdFoodName } from '../rag/ifctLoader.js';

const categoryOrder = ['Grains', 'Pulses', 'Vegetables', 'Dairy', 'Protein', 'Fruits', 'Pantry', 'Other'];

function categoryFor(foodCategory, foodName = '') {
  if (/onion|pyaaz|tomato|potato|aloo|cauliflower|gobhi|spinach|palak|bhindi|brinjal|cabbage|gourd/.test(foodName.toLowerCase())) {
    return 'Vegetables';
  }
  if (foodCategory === 'Cereals and Millets') return 'Grains';
  if (foodCategory === 'Grain Legumes') return 'Pulses';
  if (['Green Leafy Vegetables', 'Other Vegetables', 'Roots and Tubers', 'Mushrooms'].includes(foodCategory)) return 'Vegetables';
  if (foodCategory === 'Milk and Milk Products') return 'Dairy';
  if ([
    'Egg and Egg Products', 'Poultry', 'Animal Meat', 'Marine Fish', 'Marine Shellfish',
    'Marine Mollusks', 'Fresh Water Fish and Shellfish',
  ].includes(foodCategory)) return 'Protein';
  if (foodCategory === 'Fruits') return 'Fruits';
  if (['Edible Oils and Fats', 'Condiments and Spices', 'Nuts and Oil Seeds', 'Sugars'].includes(foodCategory)) return 'Pantry';

  const name = foodName.toLowerCase();
  if (/dal|gram|rajma|lentil|pulse|chana/.test(name)) return 'Pulses';
  if (/milk|paneer|curd|dahi|cheese/.test(name)) return 'Dairy';
  if (/rice|wheat|atta|roti|poha|cereal|millet|maize/.test(name)) return 'Grains';
  if (/egg|chicken|fish|meat|poultry/.test(name)) return 'Protein';
  if (/vegetable|gourd|spinach|potato|onion|tomato|cauliflower|cabbage|bhindi|brinjal|aloo|pyaaz|gobhi|palak/.test(name)) return 'Vegetables';
  if (/oil|spice|salt|sugar|masala|ginger|garlic|cumin|coriander/.test(name)) return 'Pantry';
  return 'Other';
}

function normalizeUnit(value) {
  const unit = String(value ?? 'g').trim().toLowerCase();
  if (['g', 'gram', 'grams'].includes(unit)) return { quantityUnit: 'g', factor: 1 };
  if (['kg', 'kilogram', 'kilograms'].includes(unit)) return { quantityUnit: 'g', factor: 1000 };
  if (['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'].includes(unit)) {
    return { quantityUnit: 'ml', factor: 1 };
  }
  if (['l', 'liter', 'liters', 'litre', 'litres'].includes(unit)) return { quantityUnit: 'ml', factor: 1000 };
  return { quantityUnit: unit || 'g', factor: 1 };
}

function formatAmount(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatQuantity(quantity, unit) {
  if (unit === 'g') {
    if (quantity >= 1000) {
      const kilograms = Math.floor(quantity / 1000);
      const remainder = Math.round((quantity - kilograms * 1000) * 10) / 10;
      return remainder === 0 ? `${kilograms} kg` : `${kilograms} kg ${formatAmount(remainder)} g`;
    }
    return `${formatAmount(quantity)} g`;
  }
  if (unit === 'ml') {
    if (quantity >= 1000) {
      const liters = Math.floor(quantity / 1000);
      const remainder = Math.round((quantity - liters * 1000) * 10) / 10;
      return remainder === 0 ? `${liters} L` : `${liters} L ${formatAmount(remainder)} ml`;
    }
    return `${formatAmount(quantity)} ml`;
  }
  return `${formatAmount(quantity)} ${unit}`.trim();
}

function groceryFoodName(food, ingredient) {
  if (food) {
    if (/^wheat flour, atta$/i.test(food.foodName)) return 'Atta';
    if (/^rice,/i.test(food.foodName)) return 'Rice';
    return getHouseholdFoodName(food);
  }
  return String(ingredient.canonicalName ?? ingredient.foodName ?? '').trim();
}

function mealIngredients(meal) {
  // Structured recipe data is authoritative when present. Otherwise read the
  // original persisted `items` array, whose quantities have always been grams.
  if (Array.isArray(meal?.ingredients) && meal.ingredients.length > 0) return meal.ingredients;
  return (Array.isArray(meal?.items) ? meal.items : []).map((item) => ({
    foodName: item.foodName,
    ifctCode: item.ifctCode,
    category: item.category,
    canonicalName: item.canonicalName ?? item.foodName,
    quantity: item.quantity ?? item.rawQuantityGrams ?? item.quantityGrams,
    quantityGrams: item.quantityGrams ?? item.rawQuantityGrams,
    unit: item.unit ?? 'g',
    state: item.state ?? item.rawCookedState ?? item.preparationState,
  }));
}

/** Aggregate canonical ingredients without merging unlike units or raw/cooked states. */
export function buildGroceryList(plan) {
  const totals = new Map();

  for (const meal of Array.isArray(plan?.meals) ? plan.meals : []) {
    for (const ingredient of mealIngredients(meal)) {
      const quantity = Number(ingredient.quantity ?? ingredient.rawQuantityGrams ?? ingredient.quantityGrams);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      const ifctCode = ingredient.ifctCode ? String(ingredient.ifctCode).trim() : null;
      const food = ifctCode ? getFoodByCode(ifctCode) : null;
      const foodName = groceryFoodName(food, ingredient);
      if (!foodName) continue;

      const stateValue = String(ingredient.state ?? ingredient.rawCookedState ?? ingredient.preparationState ?? '').trim().toLowerCase();
      const state = ['raw', 'cooked'].includes(stateValue) ? stateValue : null;
      const { quantityUnit, factor } = normalizeUnit(ingredient.unit ?? 'g');
      const normalizedQuantity = Math.round(quantity * factor * 10) / 10;
      const category = categoryFor(food?.category ?? ingredient.category, foodName);
      const normalizedName = foodName.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, ' ').trim();
      const key = `${category}:${normalizedName}:${quantityUnit}:${state ?? 'unspecified'}`;
      const current = totals.get(key) ?? {
        category,
        foodName,
        quantity: 0,
        unit: quantityUnit,
        state,
        ifctCodes: new Set(),
      };
      current.quantity += normalizedQuantity;
      if (ifctCode) current.ifctCodes.add(ifctCode);
      totals.set(key, current);
    }
  }

  const groups = new Map();
  for (const entry of totals.values()) {
    const items = groups.get(entry.category) ?? [];
    const quantity = Math.round(entry.quantity * 10) / 10;
    items.push({
      foodName: entry.foodName,
      ifctCodes: [...entry.ifctCodes].sort(),
      quantity,
      unit: entry.unit,
      state: entry.state,
      quantityGrams: entry.unit === 'g' ? quantity : null,
      quantityLabel: formatQuantity(quantity, entry.unit),
    });
    groups.set(entry.category, items);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => categoryOrder.indexOf(left) - categoryOrder.indexOf(right))
    .map(([category, items]) => ({
      category,
      items: items.sort((left, right) => left.foodName.localeCompare(right.foodName)
        || String(left.state ?? '').localeCompare(String(right.state ?? ''))
        || left.unit.localeCompare(right.unit)),
    }));
}

export default { buildGroceryList };
