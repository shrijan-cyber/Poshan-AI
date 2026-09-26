import mongoose from 'mongoose';

const extractedValueSchema = new mongoose.Schema(
  {
    nutrient: { type: String, required: true, trim: true },
    value: { type: Number, required: true },
    unit: { type: String, trim: true, default: '' },
    referenceRange: { type: String, trim: true, default: '' },
    flag: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
  },
  { _id: false },
);

const reportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      enum: ['pdf', 'image'],
      required: true,
    },
    ocrStatus: {
      type: String,
      enum: ['pending', 'processing', 'done', 'failed'],
      default: 'pending',
      required: true,
    },
    rawOcrText: {
      type: String,
      default: '',
    },
    extractedValues: {
      type: [extractedValueSchema],
      default: [],
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export default mongoose.models.Report ?? mongoose.model('Report', reportSchema);
