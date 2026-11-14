import type { PricedStack } from "../process/aggregate.js";

// One auction row as Blizzard returns it. Gear uses buyout. Commodities use unit_price.
export type AuctionRow = {
  id?: number;
  item?: { id?: number };
  buyout?: number;
  unit_price?: number;
  quantity?: number;
  bid?: number;
};

// The house document often points at commodities with a link object, not a list.
// The commodities document is either { auctions: [...] } or a bare array.
export function listingRows(value: unknown): AuctionRow[] {
  if (Array.isArray(value)) return value as AuctionRow[];
  if (value && typeof value === "object" && Array.isArray((value as { auctions?: unknown }).auctions)) {
    return (value as { auctions: AuctionRow[] }).auctions;
  }
  return [];
}

// Copper to buy the whole stack. Null means this row has no sale price (bid only).
function stackCost(row: AuctionRow): bigint | null {
  const quantity = row.quantity ?? 0;
  if (!Number.isInteger(quantity) || quantity <= 0) return null;

  // Commodities quote a unit price. Prefer that when it is present.
  if (row.unit_price != null && Number.isInteger(row.unit_price) && row.unit_price >= 0) {
    return BigInt(row.unit_price) * BigInt(quantity);
  }

  // Gear quotes a buyout for the whole stack. A missing buyout means bid-only.
  // Zero is a real free listing when Blizzard sends the field.
  if (row.buyout != null && Number.isInteger(row.buyout) && row.buyout >= 0) {
    return BigInt(row.buyout);
  }

  return null;
}

// Stable identity so the same auction is not counted twice when it shows up
// on both the house payload and the commodities payload.
function rowKey(row: AuctionRow): string {
  if (row.id != null) return `id:${row.id}`;
  const itemId = row.item?.id ?? "none";
  return `row:${itemId}:${row.quantity}:${row.unit_price ?? ""}:${row.buyout ?? ""}`;
}

// Turn the two Blizzard books into priced stacks. Bid-only rows are dropped.
export function stacksFromBook(
  auctions: AuctionRow[] | undefined,
  commodities: AuctionRow[] | undefined,
): { stacks: PricedStack[]; listingIds: number[] } {
  const seen = new Set<string>();
  const stacks: PricedStack[] = [];
  const listingIds: number[] = [];

  for (const row of [...(auctions ?? []), ...(commodities ?? [])]) {
    const key = rowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);

    if (row.id != null) listingIds.push(row.id);

    const itemId = row.item?.id;
    const cost = stackCost(row);
    if (itemId == null || cost == null || row.quantity == null) continue;

    stacks.push({ itemId, quantity: row.quantity, cost });
  }

  listingIds.sort((a, b) => a - b);
  return { stacks, listingIds };
}
