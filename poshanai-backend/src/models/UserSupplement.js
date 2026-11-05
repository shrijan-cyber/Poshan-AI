import mongoose from 'mongoose';
import { MICRONUTRIENTS } from '../config/constants.js';

const unitByNutrient = Object.freeze({
  vitaminA: ['µg', 'mcg', 'µg RAE', 'mcg RAE', 'IU'], vitaminC: ['mg'], vitaminD: ['IU', 'µg', 'mcg'],
  vitaminE: ['mg', 'IU'], vitaminK: ['µg', 'mcg'], vitaminB1: ['mg'], vitaminB2: ['mg'],
  vitaminB3: ['mg'], vitaminB6: ['mg'], vitaminB9: ['µg', 'mcg', 'µg DFE', 'mcg DFE'], vitaminB12: ['µg', 'mcg'],
  iron: ['mg'], calcium: ['mg'], zinc: ['mg'], magnesium: ['mg'], potassium: ['mg'],
});
const nutrientKeys = MICRONUTRIENTS.map(({ key }) => key);

const labeledQuantitySchema = new mongoose.Schema({
  amount: { type: Number, min: 0.001, max: 100000, required: true },
  unit: { type: String, trim: true, minlength: 1, maxlength: 30, required: true },
}, { _id: false });

const componentSchema = new mongoose.Schema({
  nutrient: { type: String, enum: nutrientKeys, required: true },
  amount: { type: Number, min: 0, max: 100000, required: true },
  unit: { type: String, trim: true, required: true },
}, { _id: false });
componentSchema.path('unit').validate(function validateNutrientUnit(unit) {
  return unitByNutrient[this.nutrient]?.includes(unit) ?? false;
}, 'Unit is not compatible with the selected nutrient.');

const userSupplementSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  brand: { type: String, trim: true, maxlength: 120, default: null },
  servingSize: { type: labeledQuantitySchema, required: true },
  dosage: { type: labeledQuantitySchema, default: null },
  components: { type: [componentSchema], default: [] },
  schedule: { type: String, trim: true, maxlength: 160, default: null },
  notes: { type: String, trim: true, maxlength: 1000, default: null },
}, { timestamps: true, versionKey: false });

userSupplementSchema.index({ userId: 1, updatedAt: -1 });

const UserSupplement = mongoose.models.UserSupplement ?? mongoose.model('UserSupplement', userSupplementSchema);
export { unitByNutrient };
export default UserSupplement;
