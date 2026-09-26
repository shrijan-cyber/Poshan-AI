import mongoose from 'mongoose';

const trendPointSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    value: { type: Number, required: true },
    unit: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const deficiencyLogSchema = new mongoose.Schema(
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
    nutrient: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe'],
      default: 'mild',
      required: true,
    },
    detectedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    trend: {
      type: [trendPointSchema],
      default: [],
    },
    recommendedAction: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export default mongoose.models.DeficiencyLog ??
  mongoose.model('DeficiencyLog', deficiencyLogSchema);
