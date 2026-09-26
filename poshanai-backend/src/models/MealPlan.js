import mongoose from 'mongoose';

const mealItemSchema = new mongoose.Schema(
  {
    foodName: { type: String, required: true, trim: true },
    ifctCode: { type: String, trim: true, default: '' },
    quantityGrams: { type: Number, required: true, min: 0 },
    nutrients: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false },
);

const mealSchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 1 },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      required: true,
    },
    items: {
      type: [mealItemSchema],
      default: [],
    },
  },
  { _id: false },
);

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
      default: null,
    },
    targetDeficiencies: {
      type: [String],
      default: [],
    },
    planDurationDays: {
      type: Number,
      required: true,
      min: 1,
      max: 30,
      default: 7,
    },
    meals: {
      type: [mealSchema],
      default: [],
    },
    aiModelUsed: {
      type: String,
      default: 'gemini-1.5-flash',
    },
    ragSourcesUsed: {
      type: [String],
      default: ['IFCT 2017 (Indian Food Composition Tables)'],
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed'],
      default: 'draft',
      required: true,
    },
    disclaimer: {
      type: String,
      default:
        'PoshanAI provides nutrition awareness and suggestions. It does not diagnose, treat, or replace advice from a qualified healthcare professional.',
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export default mongoose.models.MealPlan ?? mongoose.model('MealPlan', mealPlanSchema);
