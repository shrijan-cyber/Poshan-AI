import DeficiencyLog from '../models/DeficiencyLog.js';

export async function listDeficiencyLogs(req, res, next) {
  try {
    const filter = { userId: req.user.id };

    if (req.query.nutrient) {
      filter.nutrient = new RegExp(req.query.nutrient.trim(), 'i');
    }
    if (req.query.severity) {
      filter.severity = req.query.severity.trim().toLowerCase();
    }

    const deficiencyLogs = await DeficiencyLog.find(filter).sort({ detectedAt: -1 });

    return res.json({
      success: true,
      data: { deficiencyLogs },
    });
  } catch (error) {
    next(error);
  }
}

export async function getDeficiencyTrends(req, res, next) {
  try {
    const logs = await DeficiencyLog.find({ userId: req.user.id }).sort({ detectedAt: 1 });

    // Group trend points by nutrient
    const trendsByNutrient = {};

    for (const log of logs) {
      const nutrientKey = log.nutrient;
      if (!trendsByNutrient[nutrientKey]) {
        trendsByNutrient[nutrientKey] = {
          nutrient: log.nutrient,
          severity: log.severity,
          detectedAt: log.detectedAt,
          resolvedAt: log.resolvedAt,
          recommendedAction: log.recommendedAction,
          history: [],
        };
      }

      // Add points from trend array if available
      if (Array.isArray(log.trend) && log.trend.length > 0) {
        for (const point of log.trend) {
          trendsByNutrient[nutrientKey].history.push({
            date: point.date,
            value: point.value,
            unit: point.unit || '',
          });
        }
      }
    }

    const trends = Object.values(trendsByNutrient);

    return res.json({
      success: true,
      data: { trends },
    });
  } catch (error) {
    next(error);
  }
}
