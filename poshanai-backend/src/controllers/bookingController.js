import Booking from '../models/Booking.js';
import asyncHandler from '../utils/asyncHandler.js';

export const listUserBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ userId: req.user._id })
    .populate('expertId', 'name role specialization fees')
    .sort({ date: -1, timeSlot: -1, createdAt: -1 })
    .lean();

  return res.json({
    success: true,
    data: {
      bookings: bookings.map(({ _id, expertId, ...booking }) => ({
        id: String(_id),
        ...booking,
        expert: expertId ? {
          id: String(expertId._id),
          name: expertId.name,
          role: expertId.role,
          specialization: expertId.specialization,
          fees: expertId.fees,
        } : null,
      })),
    },
  });
});

export default { listUserBookings };
