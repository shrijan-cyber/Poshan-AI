import client, { payloadFrom } from './client.js';

export async function searchFoods(query, { signal, page = 1, limit = 6, category, source, state } = {}) {
  const response = await client.get('/foods/search', {
    params: { q: query, page, limit, ...(category ? { category } : {}), ...(source ? { source } : {}), ...(state ? { state } : {}) },
    signal,
  });
  const data = payloadFrom(response);
  const foods = Array.isArray(data) ? data : data.foods;
  return {
    foods: foods.map((food) => ({
      ...food,
      nutrients: food.nutrients ?? {
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
      },
    })),
    pagination: response.data?.pagination ?? null,
    filters: response.data?.filters ?? {},
  };
}

export async function getTodayLog(date, { signal } = {}) {
  return payloadFrom(await client.get('/logs/today', { params: { date }, signal }));
}

export async function getLogPage(date, page = 1, limit = 10, { signal } = {}) {
  return payloadFrom(await client.get('/logs', { params: { date, page, limit }, signal }));
}

export async function addFood({ ifctCode, quantity, measure, date }) {
  return payloadFrom(await client.post('/logs/add-food', { ifctCode, quantity, measure, date }));
}

const foodLogApi = { searchFoods, getTodayLog, addFood };
export default foodLogApi;
