import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  foodName: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1, max: 2000 },
  ifctCode: { type: String, required: true, trim: true },
  weightBasis: { type: String, enum: ['raw', 'cooked'], default: 'raw' },
  householdMeasure: { type: String, trim: true, default: null },
  rawIngredientWeight: {
    quantityGrams: { type: Number, min: 1, max: 2000 },
    unit: { type: String, enum: ['g'], default: 'g' },
  },
  rawWeightGrams: { type: Number, min: 0.001, max: 2000, default: null },
  yieldFactor: { type: Number, min: 0.001, max: 10, default: null },
  cookedWeightGrams: { type: Number, min: 0.001, max: 10000, default: null },
  cookedServingDescription: { type: String, trim: true, default: null },
}, { _id: false });

// Optional structured recipe ingredients. Legacy meal.items remain the source for
// older plans; newer plans may store explicit units and preparation state here.
const recipeIngredientSchema = new mongoose.Schema({
  ifctCode: { type: String, trim: true, default: null },
  canonicalName: { type: String, trim: true, required: true },
  quantity: { type: Number, required: true, min: 0.001 },
  rawQuantityGrams: { type: Number, min: 0.001, default: null },
  rawWeightGrams: { type: Number, min: 0.001, default: null },
  yieldFactor: { type: Number, min: 0.001, max: 10, default: null },
  cookedWeightGrams: { type: Number, min: 0.001, default: null },
  cookedServingDescription: { type: String, trim: true, default: null },
  unit: { type: String, required: true, trim: true },
  householdMeasure: { type: String, trim: true, default: null },
  state: { type: String, enum: ['raw', 'cooked'], default: null },
  ediblePortion: { type: Number, min: 0, max: 100, default: null },
}, { _id: false });

const mealSchema = new mongoose.Schema({
  recipeId: { type: String, trim: true, default: null },
  mealName: { type: String, trim: true, default: null },
  dishName: { type: String, trim: true, default: null },
  mealType: { type: String, trim: true, default: null },
  mealCategory: { type: String, enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'], default: null },
  region: { type: String, enum: ['North', 'South', 'East', 'West', 'All'], default: null },
  dietaryCompatibility: { type: [String], default: [] },
  portionDescription: { type: String, trim: true, default: null },
  cookedHouseholdMeasure: { type: String, trim: true, default: null },
  cookedServingDescription: { type: String, trim: true, default: null },
  servings: { type: Number, min: 0.1, default: null },
  prepTime: { type: Number, min: 0, default: null },
  cookTime: { type: Number, min: 0, default: null },
  cookingInstructions: { type: [String], default: [] },
  recipeInstructions: { type: [String], default: [] },
  swapSuggestion: { type: String, trim: true, maxlength: 240, default: null },
  calories: { type: Number, required: true, min: 0 },
  macros: {
    protein: { type: Number, required: true, min: 0 },
    carbs: { type: Number, required: true, min: 0 },
    fat: { type: Number, required: true, min: 0 },
  },
  items: { type: [itemSchema], default: undefined },
  ingredients: { type: [recipeIngredientSchema], default: undefined },
}, { _id: false });

mealSchema.pre('validate', function validateMealIngredients(next) {
  if (!this.mealName && !this.dishName) this.invalidate('mealName', 'A meal must have a name.');
  if (!this.items?.length && !this.ingredients?.length) {
    this.invalidate('items', 'A meal must contain at least one ingredient.');
  }
  next();
});

const groceryItemSchema = new mongoose.Schema({
  foodName: { type: String, required: true, trim: true },
  ifctCodes: { type: [String], default: [] },
  quantity: { type: Number, min: 0.001, default: null },
  unit: { type: String, trim: true, default: null },
  state: { type: String, enum: ['raw', 'cooked'], default: null },
  quantityGrams: { type: Number, min: 0.1, default: null },
  quantityLabel: { type: String, required: true, trim: true },
}, { _id: false });

const groceryCategorySchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['Grains', 'Pulses', 'Vegetables', 'Dairy', 'Protein', 'Fruits', 'Pantry', 'Other'],
  },
  items: { type: [groceryItemSchema], required: true, validate: (items) => items.length > 0 },
}, { _id: false });

const dailyNutritionSchema = new mongoose.Schema({
  day: { type: Number, min: 1, default: null },
  calories: { type: Number, min: 0, default: null },
  protein: { type: Number, min: 0, default: null },
  carbs: { type: Number, min: 0, default: null },
  fat: { type: Number, min: 0, default: null },
}, { _id: false });

const dietPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null, index: true },
  goal: { type: String, enum: ['lose', 'maintain', 'gain'], required: true },
  targetCalories: { type: Number, required: true, min: 1 },
  macros: {
    protein: { type: Number, required: true, min: 0 },
    carbs: { type: Number, required: true, min: 0 },
    fat: { type: Number, required: true, min: 0 },
  },
  // Stored deterministic IFCT totals for the generated days. Optional so
  // existing plans remain readable without backfilling or recalculating.
  dailyNutrition: { type: [dailyNutritionSchema], default: undefined },
  macroTargets: {
    protein: { type: Number, min: 0, default: null },
    carbs: { type: Number, min: 0, default: null },
    fat: { type: Number, min: 0, default: null },
  },
  conditions: { type: [String], default: [] },
  meals: { type: [mealSchema], required: true, validate: (meals) => meals.length > 0 },
  groceryList: { type: [groceryCategorySchema], default: [] },
  type: { type: String, enum: ['basic', 'personalized'], required: true, default: 'basic' },
  profile: {
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    weightKg: { type: Number, required: true },
    heightCm: { type: Number, required: true },
    activityLevel: { type: String, required: true },
    dietType: { type: String, required: true },
    region: { type: String, default: null },
    mealsPerDay: { type: Number, required: true },
    dislikes: { type: [String], default: [] },
    allergies: { type: [String], default: [] },
    preferredFoods: { type: [String], default: [] },
    typicalDiet: { type: mongoose.Schema.Types.Mixed, default: '' },
  },
  disclaimer: { type: String, required: true },
}, { timestamps: true, versionKey: false, collection: 'dietplans' });

const DietPlan = mongoose.models.DietPlan ?? mongoose.model('DietPlan', dietPlanSchema);

export default DietPlan;
