/** Group menu items by category; sort items and category sections by sort_order. */
export function groupMenuByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    const cat = item.category || 'Menu';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(item);
  }

  for (const list of groups.values()) {
    list.sort(
      (a, b) =>
        (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) ||
        a.name.localeCompare(b.name)
    );
  }

  const minSort = (categoryItems) =>
    Math.min(...categoryItems.map((i) => Number(i.sort_order) || 0));

  return [...groups.entries()].sort(([catA, itemsA], [catB, itemsB]) => {
    const orderA = minSort(itemsA);
    const orderB = minSort(itemsB);
    if (orderA !== orderB) return orderA - orderB;
    return catA.localeCompare(catB);
  });
}
