import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMealPlanJobStatus } from '../src/utils/mealPlanJobStatus.js';

test('completed meal-plan job with a plan ID proceeds to plan loading', () => {
  assert.deepEqual(classifyMealPlanJobStatus({ status: 'completed', planId: 'plan-1' }), {
    kind: 'ready', planId: 'plan-1',
  });
});

test('unachievable and failed jobs stop polling with a user-facing message', () => {
  assert.deepEqual(classifyMealPlanJobStatus({ status: 'unachievable', message: 'Target cannot be met.' }), {
    kind: 'error', message: 'Target cannot be met.',
  });
  assert.match(classifyMealPlanJobStatus({ status: 'failed' }).message, /generation failed/i);
});

test('pending jobs continue polling and completed jobs without IDs stop with an error', () => {
  assert.deepEqual(classifyMealPlanJobStatus({ status: 'active' }), { kind: 'pending', status: 'active' });
  assert.deepEqual(classifyMealPlanJobStatus({ status: 'completed' }).kind, 'error');
});
