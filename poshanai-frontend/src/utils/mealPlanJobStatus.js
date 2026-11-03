export function classifyMealPlanJobStatus(data = {}) {
  if (data.status === 'completed') {
    if (data.planId) return { kind: 'ready', planId: data.planId };
    return {
      kind: 'error',
      message: 'Meal-plan generation finished without a saved plan. Please try again.',
    };
  }

  if (data.status === 'unachievable') {
    return {
      kind: 'error',
      message: data.message || 'Available recipes could not safely meet this plan. Try different preferences or profile details.',
    };
  }

  if (data.status === 'failed') {
    return {
      kind: 'error',
      message: data.message || 'Meal-plan generation failed. Please try again.',
    };
  }

  return { kind: 'pending', status: data.status || 'processing' };
}
