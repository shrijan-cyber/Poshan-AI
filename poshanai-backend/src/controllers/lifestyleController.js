import LifestyleProfile from '../models/LifestyleProfile.js';
import asyncHandler from '../utils/asyncHandler.js';
import httpError from '../utils/httpError.js';

const profileFields = [
  'consentGiven',
  'dietType',
  'mealsPerDay',
  'typicalDiet',
  'sleepHours',
  'sleepTime',
  'sunExposure',
  'activityLevel',
  'habits',
  'symptoms',
  'region',
];

function serializeProfile(profile) {
  return Object.fromEntries([
    ['id', profile._id.toString()],
    ...profileFields.map((field) => [field, profile[field]]),
    ['createdAt', profile.createdAt],
    ['updatedAt', profile.updatedAt],
  ]);
}

export const saveOnboarding = asyncHandler(async (req, res) => {
  const update = Object.fromEntries(profileFields.map((field) => [field, req.body[field]]));
  const profile = await LifestyleProfile.findOneAndUpdate(
    { userId: req.user._id },
    { $set: update, $setOnInsert: { userId: req.user._id } },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      strict: 'throw',
    },
  );
  return res.json({ success: true, data: serializeProfile(profile) });
});

export const getOnboarding = asyncHandler(async (req, res) => {
  const profile = await LifestyleProfile.findOne({
    userId: req.user._id,
  }).lean();
  if (!profile) throw httpError(404, 'LIFESTYLE_PROFILE_NOT_FOUND', 'Lifestyle profile not found.');
  return res.json({ success: true, data: serializeProfile(profile) });
});

export default { saveOnboarding, getOnboarding };
