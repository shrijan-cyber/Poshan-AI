import mongoose from 'mongoose';
import Joi from 'joi';
import MealPlan from '../models/MealPlan.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

export const generateMealPlanSchema = Joi.object({
  reportId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).allow(null, '').optional(),
  targetDeficiencies: Joi.array().items(Joi.string().trim().max(100)).default([]),
  planDurationDays: Joi.number().integer().min(1).max(30).default(7),
  preferences: Joi.object({
    dietType: Joi.string().valid('veg', 'non-veg', 'vegan'),
    allergies: Joi.array().items(Joi.string().trim().max(100)),
    region: Joi.string().trim().max(100),
  }).optional(),
});

export const updateMealPlanStatusSchema = Joi.object({
  status: Joi.string().valid('draft', 'active', 'completed').required(),
}).required();

// Helper to generate Phase 1 Indian-context IFCT meal items
function buildDefaultIndianMeals(durationDays, dietType = 'veg') {
  const mealTemplates = [
    {
      breakfast: [
        { foodName: 'Sprouted Moong Dosa', quantityGrams: 150 },
        { foodName: 'Mint & Coriander Chutney', quantityGrams: 30 },
      ],
      lunch: [
        { foodName: 'Brown Rice / Red Rice', quantityGrams: 150 },
        { foodName: 'Palak Dal (Spinach Lentil)', quantityGrams: 200 },
        { foodName: 'Amla Cucumber Salad', quantityGrams: 100 },
      ],
      snack: [
        { foodName: 'Roasted Bengal Gram (Chana) & Jaggery', quantityGrams: 50 },
      ],
      dinner: [
        { foodName: 'Bajra or Jowar Roti', quantityGrams: 100 },
        { foodName: dietType === 'non-veg' ? 'Egg Curry / Fish Curry' : dietType === 'vegan' ? 'Tofu and Methi Bhurji' : 'Methi Paneer Bhurji', quantityGrams: 180 },
        { foodName: dietType === 'vegan' ? 'Unsweetened Fortified Plant Beverage' : 'Spiced Buttermilk (Chaas)', quantityGrams: 200 },
      ],
    },
    {
      breakfast: [
        { foodName: 'Ragi Idli with Sambhar', quantityGrams: 200 },
      ],
      lunch: [
        { foodName: 'Moringa Leaf Dal', quantityGrams: 200 },
        { foodName: 'Millet Rice (Kodo / Foxtail)', quantityGrams: 150 },
        { foodName: dietType === 'vegan' ? 'Beetroot Salad' : 'Beetroot Raita', quantityGrams: 100 },
      ],
      snack: [
        { foodName: 'Sesame (Til) & Peanut Chikki', quantityGrams: 40 },
      ],
      dinner: [
        { foodName: 'Whole Wheat Phulka (2 pcs)', quantityGrams: 80 },
        { foodName: 'Rajma / Chana Masala', quantityGrams: 200 },
        { foodName: dietType === 'vegan' ? 'Warm Turmeric Fortified Plant Beverage' : 'Warm Turmeric Spiced Milk', quantityGrams: 150 },
      ],
    },
  ];

  const meals = [];
  for (let d = 1; d <= durationDays; d += 1) {
    const template = mealTemplates[(d - 1) % mealTemplates.length];
    for (const [mealType, items] of Object.entries(template)) {
      meals.push({
        day: d,
        mealType,
        items,
      });
    }
  }
  return meals;
}

export async function generateMealPlan(req, res, next) {
  try {
    const { reportId, targetDeficiencies, planDurationDays, preferences } = req.body;

    const user = await User.findById(req.user.id);
    const userDietType = preferences?.dietType || user?.profile?.dietType || 'veg';
    if (preferences?.allergies?.length || user?.profile?.allergies?.length) {
      return res.status(422).json({
        success: false,
        error: { code: 'ALLERGY_FILTER_UNAVAILABLE', message: 'Meal plans cannot be generated safely for profiles with listed allergies yet.' },
      });
    }

    const deficienciesToTarget = [...(targetDeficiencies || [])];

    // If reportId provided, verify and extract findings
    let verifiedReportId = null;
    if (reportId) {
      if (!mongoose.Types.ObjectId.isValid(reportId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REPORT_ID', message: 'Invalid report ID format.' },
        });
      }

      const report = await Report.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: { code: 'REPORT_NOT_FOUND', message: 'Associated report not found.' },
        });
      }

      if (report.userId.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied to this report.' },
        });
      }

      verifiedReportId = report._id;

      // Extract low nutrient flags if user didn't specify targetDeficiencies
      if (deficienciesToTarget.length === 0 && Array.isArray(report.extractedValues)) {
        for (const item of report.extractedValues) {
          if (item.flag === 'low' && item.nutrient) {
            deficienciesToTarget.push(item.nutrient);
          }
        }
      }
    }

    const duration = planDurationDays || 7;
    const generatedMeals = buildDefaultIndianMeals(duration, userDietType);

    const mealPlan = await MealPlan.create({
      userId: req.user.id,
      reportId: verifiedReportId,
      targetDeficiencies: deficienciesToTarget,
      planDurationDays: duration,
      meals: generatedMeals,
      aiModelUsed: 'curated-template-v1',
      ragSourcesUsed: [],
      status: 'draft',
      generatedAt: new Date(),
    });

    logger.info('Meal plan generated', {
      mealPlanId: mealPlan.id,
      userId: req.user.id,
      duration,
    });

    return res.status(201).json({
      success: true,
      data: { mealPlan },
      message: 'Meal plan generated successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export async function listMealPlans(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = { userId: req.user.id };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [mealPlans, total] = await Promise.all([
      MealPlan.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      MealPlan.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        mealPlans,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMealPlanById(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid meal plan ID format.' },
      });
    }

    const mealPlan = await MealPlan.findById(req.params.id);
    if (!mealPlan) {
      return res.status(404).json({
        success: false,
        error: { code: 'MEAL_PLAN_NOT_FOUND', message: 'Meal plan not found.' },
      });
    }

    // BOLA check
    if (mealPlan.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied to this meal plan.' },
      });
    }

    return res.json({
      success: true,
      data: { mealPlan },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMealPlanStatus(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid meal plan ID format.' },
      });
    }

    const mealPlan = await MealPlan.findById(req.params.id);
    if (!mealPlan) {
      return res.status(404).json({
        success: false,
        error: { code: 'MEAL_PLAN_NOT_FOUND', message: 'Meal plan not found.' },
      });
    }

    // BOLA check
    if (mealPlan.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied to this meal plan.' },
      });
    }

    mealPlan.status = req.body.status;
    await mealPlan.save();

    logger.info('Meal plan status updated', {
      mealPlanId: mealPlan.id,
      userId: req.user.id,
      newStatus: req.body.status,
    });

    return res.json({
      success: true,
      data: { mealPlan },
      message: 'Meal plan status updated.',
    });
  } catch (error) {
    next(error);
  }
}
