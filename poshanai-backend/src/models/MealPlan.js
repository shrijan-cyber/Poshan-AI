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
    nutrients: { type: nutrientsSchema, required: true },
  },
  { _id: false },
);

/**
 * A single meal entry within the meal plan.
 */
const mealSchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 1, max: 30 },
    mealType: {
      type: String,
      required: true,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    },
    nutrientTargets: { type: [String], required: true, default: [] },
    proteinSource: { type: String, trim: true, maxlength: 200, required: true },
    cookingInstructions: { type: String, trim: true, maxlength: 300, required: true },
    items: { type: [itemSchema], required: true },
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
