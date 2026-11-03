import test from 'node:test';
import assert from 'node:assert/strict';
import { groceryListToText, hasGroceryItems } from '../src/utils/groceryListDownload.js';

test('formats basic diet-plan grocery response without inventing prices or amounts', () => {
  const response = [{ category: 'Grains', items: [{ foodName: 'Atta', quantityLabel: '500 g' }] }];
  assert.equal(groceryListToText(response), 'PoshanAI grocery list\n\nGrains\n- Atta — 500 g\n');
  assert.equal(hasGroceryItems(response), true);
});

test('formats report-based grocery response using its returned name and quantity', () => {
  const response = [{ category: 'Pulses', items: [{ name: 'Dal', quantity: '300g' }] }];
  assert.equal(groceryListToText(response), 'PoshanAI grocery list\n\nPulses\n- Dal — 300g\n');
});

test('returns an honest empty result for absent and empty grocery data', () => {
  assert.equal(groceryListToText(null), 'PoshanAI grocery list\n');
  assert.equal(hasGroceryItems([]), false);
  assert.equal(hasGroceryItems([{ category: 'Vegetables', items: [] }]), false);
});
