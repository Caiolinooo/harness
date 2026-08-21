export type Item = { id: string; title: string; done: boolean };
const items: Item[] = [];
export function add(title: string): Item {
  const item = { id: String(items.length + 1), title, done: false };
  items.push(item);
  return item;
}
export function list(): Item[] { return [...items]; }
export function done(id: string): boolean {
  const item = items.find((i) => i.id === id);
  if (!item) return false;
  item.done = true;
  return true;
}
