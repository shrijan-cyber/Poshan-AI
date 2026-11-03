function displayName(item) {
  return String(item?.foodName ?? item?.name ?? '').trim();
}

function displayQuantity(item) {
  return String(item?.quantityLabel ?? item?.quantity ?? '').trim();
}

export function groceryListToText(categories) {
  const lines = ['PoshanAI grocery list', ''];

  for (const group of Array.isArray(categories) ? categories : []) {
    const items = (Array.isArray(group?.items) ? group.items : [])
      .map((item) => ({ name: displayName(item), quantity: displayQuantity(item) }))
      .filter(({ name }) => name);
    if (!items.length) continue;

    lines.push(String(group.category ?? 'Other'));
    for (const item of items) {
      lines.push(`- ${item.name}${item.quantity ? ` — ${item.quantity}` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function hasGroceryItems(categories) {
  return (Array.isArray(categories) ? categories : [])
    .some((group) => Array.isArray(group?.items) && group.items.some((item) => displayName(item)));
}
