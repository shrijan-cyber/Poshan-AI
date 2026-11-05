import assert from 'node:assert/strict';
import test from 'node:test';
import UserSupplement from '../src/models/UserSupplement.js';

const baseRecord = {
  userId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  name: 'Label test',
  servingSize: { amount: 1, unit: 'tablet' },
  components: [
    { nutrient: 'vitaminD', amount: 25, unit: 'µg' },
    { nutrient: 'calcium', amount: 300, unit: 'mg' },
  ],
};

test('saved supplement model preserves original labeled values and accepts compatible nutrient units', async () => {
  const supplement = new UserSupplement(baseRecord);
  await supplement.validate();
  assert.equal(supplement.components[0].amount, 25);
  assert.equal(supplement.components[0].unit, 'µg');
  assert.equal(supplement.components[1].amount, 300);
});

test('saved supplement model rejects a unit incompatible with its nutrient', async () => {
  const supplement = new UserSupplement({
    ...baseRecord,
    components: [{ nutrient: 'calcium', amount: 5, unit: 'IU' }],
  });
  await assert.rejects(supplement.validate(), /Unit is not compatible/);
});
