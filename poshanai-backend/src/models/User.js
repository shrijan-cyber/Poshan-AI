import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    age: { type: Number, min: 1, max: 120 },
    gender: { type: String, trim: true, maxlength: 30 },
    weightKg: { type: Number, min: 1, max: 500 },
    heightCm: { type: Number, min: 30, max: 300 },
    dietType: { type: String, enum: ['veg', 'non-veg', 'vegan'] },
    allergies: { type: [String], default: [] },
    region: { type: String, trim: true, maxlength: 100 },
    activityLevel: { type: String, trim: true, maxlength: 50 },
  },
  { _id: false, versionKey: false },
);

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, default: null },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'dietitian', 'admin'], default: 'user', required: true },
    profile: { type: profileSchema, required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.models.User ?? mongoose.model('User', userSchema);
