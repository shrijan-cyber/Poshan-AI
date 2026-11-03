import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expertId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expert', required: true, index: true },
  date: { type: Date, required: true },
  timeSlot: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending', required: true },
}, { timestamps: true, versionKey: false });

bookingSchema.index(
  { expertId: 1, date: 1, timeSlot: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } },
);
bookingSchema.index({ userId: 1, date: 1 });

const Booking = mongoose.models.Booking ?? mongoose.model('Booking', bookingSchema);
export default Booking;
