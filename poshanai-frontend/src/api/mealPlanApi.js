import client, { payloadFrom } from './client.js';

export async function getMealPlans() {
  const data = payloadFrom(await client.get('/meal-plans'));
  return Array.isArray(data) ? data : (data?.mealPlans ?? data?.plans ?? []);
}

export async function getMealPlan(id) {
  return payloadFrom(await client.get(`/meal-plans/${encodeURIComponent(id)}`));
}

export async function generateMealPlan(preferences) {
  return payloadFrom(await client.post('/meal-plans', preferences));
}

const mealPlanApi = { getMealPlans, getMealPlan, generateMealPlan };
export default mealPlanApi;
