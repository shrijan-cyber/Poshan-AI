import Joi from 'joi';

const recipeIngredientSchema = Joi.object({
  ifctCode: Joi.string().trim().uppercase().pattern(/^[A-Z]\d{3}$/).required(),
  rawQuantityGrams: Joi.number().positive().max(1000).required(),
  yieldFactor: Joi.number().positive().max(10).required(),
  cookedWeightGrams: Joi.number().positive().max(10000).required(),
  householdMeasure: Joi.string().trim().min(1).max(80).required(),
}).unknown(false);

export const recipeSchema = Joi.object({
  recipeId: Joi.string().trim().pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).required(),
  dishName: Joi.string().trim().min(2).max(100).required(),
  mealCategory: Joi.string().valid('Breakfast', 'Lunch', 'Dinner', 'Snack').required(),
  region: Joi.string().valid('North', 'South', 'East', 'West', 'All').required(),
  dietaryCompatibility: Joi.array()
    .items(Joi.string().valid('Veg', 'Vegan', 'Eggetarian', 'Non-Veg'))
    .min(1)
    .unique()
    .required(),
  ingredients: Joi.array().items(recipeIngredientSchema).min(1).max(12).required(),
  servings: Joi.number().positive().max(20).required(),
  cookingInstructions: Joi.array().items(Joi.string().trim().min(8).max(300)).min(1).max(12).required(),
  prepTime: Joi.number().integer().min(0).max(240).required(),
  cookTime: Joi.number().integer().min(0).max(240).required(),
}).unknown(false);

export default recipeSchema;
