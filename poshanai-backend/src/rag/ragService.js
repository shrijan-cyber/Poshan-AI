import logger from '../utils/logger.js';
import { buildMealPlanPrompt } from './promptBuilder.js';
import {
  getHouseholdFoodName,
  getHouseholdFoodWhitelist,
  loadIfctDataset,
} from './ifctLoader.js';

export { buildMealPlanPrompt };

let foodRecords = [];
try {
  foodRecords = loadIfctDataset();
  logger.info(`Loaded ${foodRecords.length} IFCT foods from dataset`);
} catch (error) {
  logger.error('Failed to load IFCT dataset from data/ifct_2017.json', error);
}

const nutrientAvailability = Object.freeze(Object.fromEntries(
  [...new Set(foodRecords.flatMap((food) => Object.keys(food.nutrients ?? {})))].map((key) => [
    key,
    foodRecords.some((food) => Number.isFinite(food.nutrients?.[key])),
  ]),
));

const regionCodes = new Map();
const regionsByState = {
  Central: ['Chhattisgarh', 'Madhya Pradesh', 'Uttar Pradesh', 'Uttarakhand', 'Uttaranchal'],
  East: ['Bihar', 'Jharkhand', 'Odisha', 'Orissa', 'West Bengal'],
  North: ['Chandigarh', 'Delhi', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Punjab', 'Rajasthan'],
  Northeast: ['Arunachal Pradesh', 'Assam', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura'],
  South: ['Andaman & Nicobar Islands', 'Andhra Pradesh', 'Karnataka', 'Kerala', 'Lakshadweep', 'Puducherry', 'Pondicherry', 'Tamil Nadu', 'Telangana'],
  West: ['Dadra & Nagar Haveli', 'Daman & Diu', 'Goa', 'Gujarat', 'Maharashtra'],
};

for (const [index, [region, states]] of Object.entries(regionsByState).entries()) {
  regionCodes.set(region.toLowerCase(), index + 1);
  for (const state of states) regionCodes.set(state.toLowerCase(), index + 1);
}

export const supportedRegions = [...regionCodes.keys()];

const nutrientByDeficiency = {
  'Vitamin D': 'vitaminD',
  'Vitamin B12': 'vitaminB12',
  Iron: 'iron',
  Calcium: 'calcium',
  Hemoglobin: 'iron',
};

const rdaNorm = {
  vitaminD: 15,
  iron: 17,
  calcium: 1000,
  protein: 50,
  vitaminB12: 2.2,
};

const allergyAliases = {
  nuts: ['nuts'],
  peanut: ['peanuts', 'nuts'],
  peanuts: ['peanuts', 'nuts'],
  dairy: ['dairy'],
  milk: ['dairy'],
  eggs: ['eggs'],
  egg: ['eggs'],
  fish: ['fish'],
  shellfish: ['shellfish'],
  soy: ['soy'],
  gluten: ['gluten'],
  wheat: ['gluten'],
  legumes: ['legumes'],
  poultry: ['poultry'],
  mushrooms: ['mushrooms'],
  sesame: ['sesame'],
  seeds: ['seeds'],
};

const round = (value) => (value === null || value === undefined ? null : Math.round(Number(value) * 100) / 100);

export function getFoodByIfctCode(ifctCode) {
  const normalizedCode = String(ifctCode ?? '').trim().toUpperCase();
  return foodRecords.find((food) => food.ifctCode.toUpperCase() === normalizedCode) ?? null;
}

export function searchIfctFoods(query, limit = 20) {
  const normalizedQuery = String(query ?? '').trim().toLowerCase();
  if (!normalizedQuery) return [];
  return foodRecords
    .filter((food) => food.foodName.toLowerCase().includes(normalizedQuery)
      || food.ifctCode.toLowerCase().includes(normalizedQuery))
    .slice(0, Math.max(1, Math.min(30, limit)))
    .map((food) => ({
      ifctCode: food.ifctCode,
      foodName: food.foodName,
      nutrients: {
        calories: food.nutrients.calories,
        protein: food.nutrients.protein,
        carbs: food.nutrients.carbs,
        fat: food.nutrients.fat,
      },
    }));
}

export function getIfctFoodCatalog() {
  return foodRecords.map(({ ifctCode, foodName }) => ({ ifctCode, foodName }));
}

export function getIfctNutrientAvailability() {
  return { ...nutrientAvailability };
}

/**
 * Retrieves and ranks top 20-30 IFCT 2017 foods for target nutrient deficiencies,
 * filtered by user dietary preference, excluding allergens, and prioritizing regional foods.
 */
export function retrieveFoodsForDeficiencies(deficiencies = [], preferences = {}) {
  const dietType = preferences.dietType ?? 'veg';
  const householdDiet = String(preferences.householdDiet ?? '');
  const excludedAllergens = new Set(
    (preferences.allergies ?? []).flatMap((allergy) => allergyAliases[allergy.toLowerCase()] ?? [allergy.toLowerCase()]),
  );
  const requestedRegion = preferences.region ? regionCodes.get(preferences.region.toLowerCase()) : null;
  const relevantNutrients = deficiencies
    .map((deficiency) => nutrientByDeficiency[deficiency.nutrient])
    .filter(Boolean);

  const householdFoods = getHouseholdFoodWhitelist(foodRecords, householdDiet);
  const filtered = householdFoods
    .filter((food) => {
      if (dietType === 'veg') return food.dietTags.includes('veg');
      if (dietType === 'eggetarian') return food.dietTags.includes('eggetarian') || food.dietTags.includes('veg');
      if (dietType === 'vegan') {
        return food.dietTags.includes('veg')
          && !/milk and milk products|egg and egg products|poultry|animal meat|marine fish|marine shellfish|marine mollusks|fresh water fish/i.test(food.category);
      }
      return true; // nonveg allows all foods
    })
    .filter((food) => !food.allergens.some((allergen) => excludedAllergens.has(allergen)));

  // Rank foods by nutrient density for target deficiencies with regional prioritization
  const scored = filtered.map((food) => {
    let nutrientScore = 0;
    if (relevantNutrients.length > 0) {
      for (const nutrient of relevantNutrients) {
        const val = food.nutrients[nutrient] ?? 0;
        const norm = rdaNorm[nutrient] ?? 1;
        nutrientScore += (val / norm);
      }
    } else {
      // General nutrient density fallback
      nutrientScore =
        ((food.nutrients.protein ?? 0) / rdaNorm.protein) +
        ((food.nutrients.iron ?? 0) / rdaNorm.iron) +
        ((food.nutrients.calcium ?? 0) / rdaNorm.calcium) +
        ((food.nutrients.vitaminD ?? 0) / rdaNorm.vitaminD);
    }

    let regionMultiplier = 1.0;
    if (requestedRegion) {
      if (food.regionCode === requestedRegion) regionMultiplier = 1.35;
      else if (food.regionCode === 6) regionMultiplier = 1.0;
      else regionMultiplier = 0.85;
    }

    return {
      food,
      finalScore: nutrientScore * regionMultiplier,
    };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore || a.food.ifctCode.localeCompare(b.food.ifctCode));

  const limit = Math.max(16, Math.min(20, preferences.limit ?? 18));

  const selectedFoods = scored.slice(0, limit).map(({ food }) => food);
  const stapleGroups = [
    { mention: /roti|chapati|phulka|wheat|atta/i, food: /wheat flour, atta/i },
    { mention: /rice/i, food: /rice, (?:raw, milled|parboiled, milled|raw, brown)/i },
    { mention: /dal|dahl|lentil|pulse|gram/i, food: /dal|lentil|pulse|gram/i },
  ];
  for (const group of stapleGroups) {
    if (!group.mention.test(householdDiet)) continue;
    const staple = filtered.find((food) => group.food.test(food.foodName));
    if (staple && selectedFoods.length < 30 && !selectedFoods.some((food) => food.ifctCode === staple.ifctCode)) selectedFoods.push(staple);
  }

  const everydayBaseCodes = ['A011', 'A015', 'B001', 'D036', 'D076', 'C033', 'F006', 'G017'];
  for (const code of everydayBaseCodes) {
    const food = filtered.find((candidate) => candidate.ifctCode === code);
    if (food && selectedFoods.length < 30 && !selectedFoods.some((candidate) => candidate.ifctCode === code)) selectedFoods.push(food);
  }

  const proteinCodesByDiet = {
    veg: ['L003', 'B010', 'B013', 'B021', 'B001'],
    eggetarian: ['M004', 'L003', 'B010', 'B013'],
    nonveg: ['M004', 'N003', 'L003', 'B010'],
    vegan: ['B024', 'B025', 'B010', 'B013'],
  };
  const proteinFood = (proteinCodesByDiet[dietType] ?? proteinCodesByDiet.veg)
    .map((code) => filtered.find((food) => food.ifctCode === code))
    .find((food) => food && Number(food.nutrients?.protein) >= 10);
  if (proteinFood && !selectedFoods.some((food) => food.ifctCode === proteinFood.ifctCode) && selectedFoods.length < 30) {
    selectedFoods.push(proteinFood);
  }

  return selectedFoods.map((food) => ({
    ifctCode: food.ifctCode,
    foodName: food.foodName,
    householdName: getHouseholdFoodName(food),
    category: food.category,
    nutrients: Object.fromEntries(
      Object.entries(food.nutrients).map(([name, value]) => [name, value === null ? null : round(value)]),
    ),
    servingSize: 100,
  }));
}

export function getMedicalDisclaimer() {
  return 'PoshanAI provides nutrition awareness and suggestions. It does not diagnose, treat, or replace advice from a qualified healthcare professional.';
}

export default {
  retrieveFoodsForDeficiencies,
  getFoodByIfctCode,
  searchIfctFoods,
  getIfctFoodCatalog,
  getIfctNutrientAvailability,
  getMedicalDisclaimer,
  buildMealPlanPrompt,
  supportedRegions,
};
