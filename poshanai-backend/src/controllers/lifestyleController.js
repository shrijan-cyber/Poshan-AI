import LifestyleProfile from '../models/LifestyleProfile.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import httpError from '../utils/httpError.js';
import {
  DISCLAIMER,
  evaluateTestRules,
  getTestRuleCatalogStatus,
  testRules,
} from '../services/testRules.js';

// Include all possible fields from both branches
const PROFILE_FIELDS = [
  'age', 'gender', 'weightKg', 'heightCm', 'dietType', 'region',
  'sunExposure', 'symptoms', 'typicalDiet', 'dailyDietDescription', 'mealsPerDay',
  'sleepHours', 'sleepTime', 'activityLevel', 'habits', 'familyHistory', 'consent'
];

function serializeProfile(profile) {
  return Object.fromEntries(PROFILE_FIELDS
    .filter((field) => profile[field] !== undefined)
    .map((field) => [field, profile[field]]));
}

function recommendationsFor(profile) {
  const catalogStatus = getTestRuleCatalogStatus();
  if (catalogStatus.status !== 'ready') {
    throw httpError(503, 'RECOMMENDATION_RULES_UNAVAILABLE', 'Lifestyle recommendation rules are temporarily unavailable. Please try again later.');
  }
  return evaluateTestRules(profile);
}

function assertRecommendationCatalogAvailable() {
  const catalogStatus = getTestRuleCatalogStatus();
  if (catalogStatus.status !== 'ready') {
    throw httpError(503, 'RECOMMENDATION_RULES_UNAVAILABLE', 'Lifestyle recommendation rules are temporarily unavailable. Please try again later.');
  }
}

function recommendationStatus(recommendations) {
  return recommendations.length > 0 ? 'ready' : 'no_matches';
}

// Robust save logic from main branch
export const saveOnboarding = asyncHandler(async (req, res) => {
  assertRecommendationCatalogAvailable();
  const userId = req.user._id;
  const profile = serializeProfile(req.body);
  const update = { $set: profile, $setOnInsert: { userId } };
  const omitted = PROFILE_FIELDS.filter((field) => !Object.hasOwn(profile, field));
  if (omitted.length) update.$unset = Object.fromEntries(omitted.map((field) => [field, 1]));

  let saved;
  try {
    saved = await LifestyleProfile.findOneAndUpdate({ userId }, update, {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    });
  } catch (error) {
    // A concurrent first submission may win the unique userId insert race.
    if (error?.code !== 11000) throw error;
    saved = await LifestyleProfile.findOneAndUpdate({ userId }, update, {
      new: true,
      runValidators: true,
    });
  }
  if (!saved) throw httpError(500, 'LIFESTYLE_PROFILE_SAVE_FAILED', 'Lifestyle profile could not be saved.');

  const completion = await User.updateOne({ _id: userId }, { $set: { onboardingCompleted: true } });
  if (completion.matchedCount !== 1) {
    throw httpError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const suggestions = recommendationsFor(saved);

  return res.status(200).json({
    success: true,
    data: {
      profile: {
        id: saved.id,
        ...serializeProfile(saved),
        updatedAt: saved.updatedAt,
      },
      suggestions,
      recommendations: suggestions,
      disclaimer: DISCLAIMER,
      routineMessage: suggestions.length === 0 ? testRules.routineMessage : null,
      rulesVersion: testRules.catalogVersion,
      recommendationStatus: recommendationStatus(suggestions),
    },
  });
});

// Recommendations logic from feature branch
export const getRecommendations = asyncHandler(async (req, res) => {
  assertRecommendationCatalogAvailable();
  const profile = await LifestyleProfile.findOne({ userId: req.user._id })
    .sort({ updatedAt: -1, _id: -1 })
    .lean();
  if (!profile) return res.json({ success: true, data: {
    recommendations: [], disclaimer: DISCLAIMER, routineMessage: testRules.routineMessage,
    rulesVersion: testRules.catalogVersion, recommendationStatus: 'needs_onboarding',
  } });
  
  const recommendations = recommendationsFor(profile);
  
  return res.json({ success: true, data: {
    recommendations,
    disclaimer: DISCLAIMER,
    routineMessage: recommendations.length === 0 ? testRules.routineMessage : null,
    rulesVersion: testRules.catalogVersion,
    recommendationStatus: recommendationStatus(recommendations),
  } });
});

// AI Explanation logic from feature branch
export const explainTest = asyncHandler(async (req, res) => {
  const explanations = {
    'Vitamin D': {
      english: 'This test measures vitamin D in your blood. Your answers suggest a topic you could discuss with your doctor; only a clinician can decide whether testing is suitable.',
      hinglish: 'Yeh test blood mein vitamin D level check karta hai. Aapke answers ek discussion point suggest karte hain; test ki zaroorat doctor hi decide karenge.',
    },
    'Vitamin B12': {
      english: 'This test measures vitamin B12 in your blood. Your answers suggest a topic you could discuss with your doctor; only a clinician can decide whether testing is suitable.',
      hinglish: 'Yeh test blood mein vitamin B12 level check karta hai. Aapke answers ek discussion point suggest karte hain; test ki zaroorat doctor hi decide karenge.',
    },
    'Complete blood count (CBC)': {
      english: 'A CBC measures several types of blood cells. Your answers suggest a topic you could discuss with your doctor; only a clinician can decide whether testing is suitable.',
      hinglish: 'CBC blood cells ke baare mein information deta hai. Aapke answers ek discussion point suggest karte hain; test ki zaroorat doctor hi decide karenge.',
    },
    'CBC (Complete Blood Count)': {
      english: 'A CBC measures several types of blood cells. Your answers suggest a topic to discuss; only a clinician can decide whether this evaluation is suitable.',
      hinglish: 'CBC blood cells ke baare mein information deta hai. Aapke answers ek discussion point hain; test ki zaroorat doctor hi decide karenge.',
    },
    HbA1c: {
      english: 'HbA1c estimates average blood sugar over the past few months. Your family history is one factor to discuss; a clinician can decide whether screening is appropriate.',
      hinglish: 'HbA1c pichhle kuch mahino ke average blood sugar ka estimate deta hai. Family history ek discussion point hai; screening doctor decide karenge.',
    },
    'TSH (Thyroid-Stimulating Hormone)': {
      english: 'TSH is a blood test used to assess thyroid function. Hair fall can have many causes; a clinician can decide whether thyroid testing is suitable.',
      hinglish: 'TSH thyroid function assess karne ke liye blood test hai. Hair fall ke kai causes ho sakte hain; test doctor decide karenge.',
    },
    '25-hydroxyvitamin D': {
      english: 'This blood test measures vitamin D status. Your answers cannot establish a deficiency; a doctor can decide whether testing is appropriate.',
      hinglish: 'Yeh blood test vitamin D status check karta hai. Aapke answers deficiency confirm nahi karte; test doctor decide karenge.',
    },
    'Vitamin B12 assessment discussion': {
      english: 'A vitamin B12 blood test measures B12 status. A vegan diet is one topic to discuss with a clinician; it does not show that you have a deficiency.',
      hinglish: 'Vitamin B12 blood test B12 status check karta hai. Vegan diet doctor se discuss karne ka ek topic hai; isse deficiency confirm nahi hoti.',
    },
    'Clinical evaluation for fatigue': {
      english: 'Fatigue can have many causes. A clinician can review your health history and decide whether a CBC or other evaluation is appropriate.',
      hinglish: 'Thakaan ke kai causes ho sakte hain. Doctor aapki health history dekh kar decide karenge ki CBC ya koi aur evaluation zaroori hai ya nahi.',
    },
    'Clinical discussion about hair fall': {
      english: 'Hair fall can have several causes. A clinician can assess your situation and decide whether any test or other evaluation is appropriate.',
      hinglish: 'Hair fall ke kai causes ho sakte hain. Doctor aapki situation dekh kar decide karenge ki koi test ya evaluation chahiye ya nahi.',
    },
    'Vitamin D assessment discussion': {
      english: 'A 25-hydroxyvitamin D blood test measures vitamin D status. Bone discomfort and low sunlight do not identify a cause; a clinician can decide whether testing is appropriate.',
      hinglish: '25-hydroxyvitamin D blood test vitamin D status check karta hai. Bone discomfort aur kam dhoop cause confirm nahi karte; test doctor decide karenge.',
    },
  };

  const testName = req.body.testName;
  const language = req.body.language || 'english';
  const explanation = explanations[testName] ? explanations[testName][language] : 'Explanation not available. Please consult a doctor.';

  return res.json({
    success: true,
    data: { explanation, disclaimer: DISCLAIMER },
  });
});

export default { saveOnboarding, getRecommendations, explainTest };
