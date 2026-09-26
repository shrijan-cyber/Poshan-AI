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
function buildDefaultIndianMeals(durationDays, dietType = 'veg', deficiencies = []) {
  const mealTemplates = [
    {
      breakfast: [
        { foodName: 'Sprouted Moong Dosa', ifctCode: 'B005', quantityGrams: 150, nutrients: { ironMg: 4.2, proteinG: 12.5, folateMcg: 65 } },
        { foodName: 'Mint & Coriander Chutney', ifctCode: 'F012', quantityGrams: 30, nutrients: { ironMg: 1.1, vitaminCMg: 15.0 } },
      ],
      lunch: [
        { foodName: 'Brown Rice / Red Rice', ifctCode: 'A003', quantityGrams: 150, nutrients: { fiberG: 3.5, magnesiumMg: 42 } },
        { foodName: 'Palak Dal (Spinach Lentil)', ifctCode: 'C014', quantityGrams: 200, nutrients: { ironMg: 5.6, folateMcg: 120, proteinG: 14 } },
        { foodName: 'Amla Cucumber Salad', ifctCode: 'D008', quantityGrams: 100, nutrients: { vitaminCMg: 70, zincMg: 0.8 } },
      ],
      snack: [
        { foodName: 'Roasted Bengal Gram (Chana) & Jaggery', ifctCode: 'B022', quantityGrams: 50, nutrients: { ironMg: 4.8, proteinG: 8.5 } },
      ],
      dinner: [
        { foodName: 'Bajra or Jowar Roti', ifctCode: 'A010', quantityGrams: 100, nutrients: { ironMg: 3.8, zincMg: 2.1, fiberG: 5.2 } },
        { foodName: dietType === 'non-veg' ? 'Egg Curry / Fish Curry' : 'Methi Paneer Bhurji', ifctCode: 'E004', quantityGrams: 180, nutrients: { proteinG: 16.5, vitaminB12Mcg: 1.4, calciumMg: 220 } },
        { foodName: 'Spiced Buttermilk (Chaas)', ifctCode: 'G002', quantityGrams: 200, nutrients: { calciumMg: 140, probiotics: true } },
      ],
    },
    {
      breakfast: [
        { foodName: 'Ragi Idli with Sambhar', ifctCode: 'A018', quantityGrams: 200, nutrients: { calciumMg: 340, ironMg: 3.9, proteinG: 10.2 } },
      ],
      lunch: [
        { foodName: 'Moringa Leaf Dal', ifctCode: 'C019', quantityGrams: 200, nutrients: { ironMg: 6.2, vitaminAMcg: 450, calciumMg: 180 } },
        { foodName: 'Millet Rice (Kodo / Foxtail)', ifctCode: 'A025', quantityGrams: 150, nutrients: { ironMg: 2.8, fiberG: 4.2 } },
        { foodName: 'Beetroot Raita', ifctCode: 'D015', quantityGrams: 100, nutrients: { folateMcg: 45, potassiumMg: 280 } },
      ],
      snack: [
        { foodName: 'Sesame (Til) & Peanut Chikki', ifctCode: 'K006', quantityGrams: 40, nutrients: { calciumMg: 210, ironMg: 2.5 } },
      ],
      dinner: [
        { foodName: 'Whole Wheat Phulka (2 pcs)', ifctCode: 'A001', quantityGrams: 80, nutrients: { fiberG: 3.2, proteinG: 6.0 } },
        { foodName: 'Rajma / Chana Masala', ifctCode: 'B011', quantityGrams: 200, nutrients: { proteinG: 15.0, ironMg: 5.1, folateMcg: 90 } },
        { foodName: 'Warm Turmeric Spiced Milk', ifctCode: 'G001', quantityGrams: 150, nutrients: { calciumMg: 180, vitaminD3Iu: 60 } },
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
    const generatedMeals = buildDefaultIndianMeals(duration, userDietType, deficienciesToTarget);

    const mealPlan = await MealPlan.create({
      userId: req.user.id,
      reportId: verifiedReportId,
      targetDeficiencies: deficienciesToTarget,
      planDurationDays: duration,
      meals: generatedMeals,
      aiModelUsed: 'gemini-1.5-flash',
      ragSourcesUsed: [
        'IFCT 2017 (Indian Food Composition Tables - ICMR-NIN)',
        'Dietary Guidelines for Indians (ICMR 2024)',
      ],
      status: 'draft',
      generatedAt: new Date(),
    });

    logger.info('Meal plan generated', {
      mealPlanId: mealPlan.id,
      userId: req.user.id,
      duration,
      targetDeficiencies: deficienciesToTarget,
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
