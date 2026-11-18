// Order item suggestions for a search box.
// Exact name, then a name that starts with the text, then a name that contains it,
// then an item id that starts with it. Each group is alphabetical. Eight is the cap.

export type SuggestItem = {
  itemId: number;
  name: string;
  icon?: string | null;
};

const LIMIT = 8;

function groupOf(item: SuggestItem, query: string): number | null {
  const name = item.name.trim().toLowerCase();
  if (name && name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (String(item.itemId).startsWith(query)) return 3;
  return null;
}

// One row per item. The first copy wins, so a deal listed twice does not appear twice.
export function rankSuggestions(items: SuggestItem[], query: string): SuggestItem[] {
  const text = query.trim().toLowerCase();
  if (text.length < 2) return [];
  const seen = new Set<number>();
  const ranked: { item: SuggestItem; group: number }[] = [];
  for (const item of items) {
    if (seen.has(item.itemId)) continue;
    seen.add(item.itemId);
    const group = groupOf(item, text);
    if (group == null) continue;
    ranked.push({ item, group });
  }
  ranked.sort((a, b) => {
    if (a.group !== b.group) return a.group - b.group;
    const byName = a.item.name.localeCompare(b.item.name, undefined, { sensitivity: "base" });
    if (byName !== 0) return byName;
    return a.item.itemId - b.item.itemId;
  });
  return ranked.slice(0, LIMIT).map((row) => row.item);
}
