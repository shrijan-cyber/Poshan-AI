import Expert from '../models/Expert.js';
import ExpertAppointment from '../models/ExpertAppointment.js';
import Booking from '../models/Booking.js';
import asyncHandler from '../utils/asyncHandler.js';
import httpError from '../utils/httpError.js';
import { getIndiaSlotParts, makeSlotDateTime } from '../services/expertBookingService.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const list = asyncHandler(async (req, res) => {
  const {
    role,
    specialization,
    minExperience,
    minRating,
    maxFees,
    availableOn,
  } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (specialization) filter.specialization = { $regex: escapeRegex(specialization), $options: 'i' };
  if (minExperience !== undefined) filter.experienceYears = { $gte: Number(minExperience) };
  if (minRating !== undefined) filter.rating = { $gte: Number(minRating) };
  if (maxFees !== undefined) filter.fees = { $lte: Number(maxFees) };
  if (availableOn) {
    const start = new Date(`${availableOn}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    filter.$or = [
      { availability: { $elemMatch: { $gte: start, $lt: end } } },
      { availableSlots: { $elemMatch: { $gte: start, $lt: end } } },
    ];
  }

  const experts = await Expert.find(filter)
    .select('name photoUrl role experienceYears specialization availability availableSlots rating fees')
    .sort({ rating: -1, name: 1 })
    .lean();
  return res.json({
    success: true,
    data: {
      experts: experts.map(({ _id, ...expert }) => ({
        id: _id,
        ...expert,
        availability: expert.availability?.length ? expert.availability : expert.availableSlots ?? [],
      })),
      count: experts.length,
    },
  });
});

export const book = asyncHandler(async (req, res) => {
  const scheduledAt = new Date(req.body.scheduledAt);
  const { date, timeSlot } = getIndiaSlotParts(scheduledAt);
  const expert = await Expert.findOneAndUpdate(
    { _id: req.body.expertId, $or: [{ availability: scheduledAt }, { availableSlots: scheduledAt }] },
    { $pull: { availability: scheduledAt, availableSlots: scheduledAt } },
    { new: true },
  ).select('name role specialization fees');
  if (!expert) {
    const [existingAppointment, existingBooking] = await Promise.all([
      ExpertAppointment.exists({ expertId: req.body.expertId, scheduledAt, status: 'booked' }),
      Booking.exists({ expertId: req.body.expertId, date: new Date(`${date}T00:00:00.000Z`), timeSlot, status: { $in: ['pending', 'confirmed'] } }),
    ]);
    if (existingAppointment || existingBooking) {
      throw httpError(409, 'EXPERT_SLOT_BOOKED', 'This expert slot has already been booked.');
    }
    throw httpError(404, 'EXPERT_SLOT_NOT_FOUND', 'Expert or requested available slot was not found.');
  }

  try {
    const appointment = await ExpertAppointment.create({
      userId: req.user.id,
      expertId: expert.id,
      scheduledAt,
    });
    return res.status(201).json({
      success: true,
      data: {
        appointment: {
          id: appointment.id,
          expert: {
            id: expert.id,
            name: expert.name,
            role: expert.role,
            specialization: expert.specialization,
            fees: expert.fees,
          },
          scheduledAt: appointment.scheduledAt,
          status: appointment.status,
        },
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      throw httpError(409, 'EXPERT_SLOT_BOOKED', 'This expert slot has already been booked.');
    }
    await Expert.updateOne({ _id: expert._id }, { $addToSet: { availability: scheduledAt, availableSlots: scheduledAt } });
    throw error;
  }
});

export const bookSlot = asyncHandler(async (req, res) => {
  const { date, timeSlot } = req.body;
  const slotDateTime = makeSlotDateTime(date, timeSlot);
  if (slotDateTime <= new Date()) {
    throw httpError(400, 'EXPERT_SLOT_IN_PAST', 'Choose a future consultation slot.');
  }

  const normalizedDate = new Date(`${date}T00:00:00.000Z`);
  const [existingBooking, existingAppointment] = await Promise.all([
    Booking.exists({ expertId: req.params.id, date: normalizedDate, timeSlot, status: { $in: ['pending', 'confirmed'] } }),
    ExpertAppointment.exists({ expertId: req.params.id, scheduledAt: slotDateTime, status: 'booked' }),
  ]);
  if (existingBooking || existingAppointment) {
    throw httpError(409, 'EXPERT_SLOT_BOOKED', 'This expert slot has already been booked.');
  }

  const expert = await Expert.findOneAndUpdate(
    { _id: req.params.id, $or: [{ availableSlots: slotDateTime }, { availability: slotDateTime }] },
    { $pull: { availableSlots: slotDateTime, availability: slotDateTime } },
    { new: true },
  ).select('name role specialization fees');
  if (!expert) throw httpError(404, 'EXPERT_SLOT_NOT_FOUND', 'Expert or requested available slot was not found.');

  try {
    const booking = await Booking.create({
      userId: req.user._id,
      expertId: expert._id,
      date: normalizedDate,
      timeSlot,
      status: 'pending',
    });
    return res.status(201).json({
      success: true,
      data: {
        booking: {
          id: String(booking._id),
          expert: {
            id: String(expert._id),
            name: expert.name,
            role: expert.role,
            specialization: expert.specialization,
            fees: expert.fees,
          },
          date,
          timeSlot,
          status: booking.status,
        },
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      throw httpError(409, 'EXPERT_SLOT_BOOKED', 'This expert slot has already been booked.');
    }
    await Expert.updateOne({ _id: expert._id }, { $addToSet: { availableSlots: slotDateTime, availability: slotDateTime } });
    throw error;
  }
});

export default { list, book, bookSlot };
