import mongoose from 'mongoose';

/**
 * Nutrient values for one food item in a meal plan.
 */
const nutrientsSchema = new mongoose.Schema(
  {
    calories: { type: Number, min: 0, default: null },
    protein: { type: Number, min: 0, default: null },
    carbs: { type: Number, min: 0, default: null },
    fat: { type: Number, min: 0, default: null },
    iron: { type: Number, min: 0, default: null },
    calcium: { type: Number, min: 0, default: null },
    vitaminD: { type: Number, min: 0, default: null },
    vitaminB12: { type: Number, min: 0, default: null },
  },
  { _id: false },
);

/**
 * A food and its serving size within a meal.
 */
const itemSchema = new mongoose.Schema(
  {
    foodName: { type: String, required: true, trim: true },
    ifctCode: { type: String, required: true, trim: true },
    quantityGrams: { type: Number, required: true, min: 1, max: 2000 },
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
    nutrients: { type: nutrientsSchema, required: true },
  },
  { _id: false },
);

const recipeIngredientSchema = new mongoose.Schema(
  {
    ifctCode: { type: String, trim: true, default: null },
    canonicalName: { type: String, trim: true, required: true },
    quantity: { type: Number, required: true, min: 0.001 },
    rawQuantityGrams: { type: Number, min: 0.001, default: null },
    rawWeightGrams: { type: Number, min: 0.001, max: 2000, default: null },
    yieldFactor: { type: Number, min: 0.001, max: 10, default: null },
    cookedWeightGrams: { type: Number, min: 0.001, max: 10000, default: null },
    cookedServingDescription: { type: String, trim: true, default: null },
    unit: { type: String, required: true, trim: true },
    householdMeasure: { type: String, trim: true, default: null },
    state: { type: String, enum: ['raw', 'cooked'], default: null },
  },
  { _id: false },
);

/**
 * A single meal entry within the meal plan.
 */
const mealSchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 1, max: 30 },
    recipeId: { type: String, trim: true, default: null },
    dishName: { type: String, trim: true, default: null },
    mealCategory: { type: String, enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'], default: null },
    region: { type: String, enum: ['North', 'South', 'East', 'West', 'All'], default: null },
    dietaryCompatibility: { type: [String], default: [] },
    servings: { type: Number, min: 0.1, default: null },
    // Additive persisted totals from the deterministic IFCT composer. Optional
    // so existing meal-plan documents remain readable without a migration.
    calories: { type: Number, min: 0, default: null },
    macros: {
      protein: { type: Number, min: 0, default: null },
      carbs: { type: Number, min: 0, default: null },
      fat: { type: Number, min: 0, default: null },
    },
    mealType: {
      type: String,
      required: true,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    },
    nutrientTargets: { type: [String], required: true, default: [] },
    proteinSource: { type: String, trim: true, maxlength: 200, required: true },
    cookingInstructions: { type: String, trim: true, maxlength: 300, required: true },
    recipeInstructions: { type: [String], default: [] },
    prepTime: { type: Number, min: 0, default: null },
    cookTime: { type: Number, min: 0, default: null },
    portionDescription: { type: String, trim: true, maxlength: 120, default: null },
    cookedHouseholdMeasure: { type: String, trim: true, maxlength: 120, default: null },
    cookedServingDescription: { type: String, trim: true, maxlength: 500, default: null },
    items: { type: [itemSchema], required: true },
    ingredients: { type: [recipeIngredientSchema], default: [] },
  },
  { _id: false },
);

/**
 * Schema for a user's generated nutrition meal plan.
 */
const mealPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      required: true,
      index: true,
    },
    title: { type: String, trim: true, default: 'Personalized Meal Plan' },
    preferences: { type: Object, default: {} },
    householdDiet: { type: String, trim: true, maxlength: 600, default: '' },
    targetDeficiencies: { type: [String], default: [] },
    targetCalories: { type: Number, min: 1, default: null },
    macroTargets: {
      protein: { type: Number, min: 0, default: null },
      carbs: { type: Number, min: 0, default: null },
      fat: { type: Number, min: 0, default: null },
    },
    supplementGuidance: { type: String, trim: true, default: null },
    planDurationDays: { type: Number, required: true, min: 1, max: 30, default: 7 },
    meals: {
      type: [mealSchema],
      required: true,
      validate: {
        validator(meals) {
          if (!Array.isArray(meals) || meals.length < 7) return false;
          const days = new Set(meals.map((meal) => meal.day));
          return days.size >= 7;
        },
        message: 'A meal plan must cover all seven days.',
      },
    },
    aiModelUsed: { type: String, default: 'omniroute-default' },
    ragSourcesUsed: { type: [String], default: [] },
    disclaimer: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'active', 'completed'],
      default: 'active',
      index: true,
    },
    generatedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

const MealPlan = mongoose.models.MealPlan ?? mongoose.model('MealPlan', mealPlanSchema);

export default MealPlan;
