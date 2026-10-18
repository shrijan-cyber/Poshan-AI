import mongoose from 'mongoose';

const lifestyleProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    consentGiven: { type: Boolean, required: true, enum: [true] },
    dietType: {
      type: String,
      enum: ['veg', 'non-veg', 'vegan', 'eggetarian'],
      required: true,
    },
    mealsPerDay: { type: Number, min: 1, max: 6, required: true },
    typicalDiet: {
      type: [{ type: String, trim: true, maxlength: 80 }],
      default: [],
      validate: (items) => items.length <= 10,
    },
    sleepHours: { type: Number, min: 3, max: 14, required: true },
    sleepTime: {
      type: String,
      enum: ['early', 'normal', 'late night'],
      required: true,
    },
    sunExposure: {
      type: String,
      enum: ['high', 'moderate', 'low'],
      required: true,
    },
    activityLevel: {
      type: String,
      enum: ['sedentary', 'moderate', 'active'],
      required: true,
    },
    habits: {
      type: [{ type: String, enum: ['smoking', 'alcohol', 'none'] }],
      default: [],
      validate: (items) => items.length <= 3,
    },
    symptoms: {
      type: [{ type: String, enum: ['fatigue', 'hair fall', 'bone pain', 'none'] }],
      default: [],
      validate: (items) => items.length <= 4,
    },
    region: { type: String, trim: true, maxlength: 100, required: true },
  },
  { timestamps: true, versionKey: false },
);

const LifestyleProfile =
  mongoose.models.LifestyleProfile ?? mongoose.model('LifestyleProfile', lifestyleProfileSchema);
export default LifestyleProfile;
