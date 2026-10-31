import client, { payloadFrom } from './client.js';

export async function generateBasicDietPlan(request) {
  return payloadFrom(await client.post('/diet-plans/generate-basic', request));
}

export async function getDietPlans() {
  const data = payloadFrom(await client.get('/diet-plans'));
  return Array.isArray(data) ? data : (data?.plans ?? []);
}

export async function getDietPlanGroceryList(id) {
  const data = payloadFrom(await client.get(`/diet-plans/${encodeURIComponent(id)}/grocery-list`));
  return data?.groceryList ?? [];
}

export default { generateBasicDietPlan, getDietPlans, getDietPlanGroceryList };
