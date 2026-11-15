// Cross-sell between the Alliance house and the neutral house.
// Buy at one house's P10. Sell at the other's P10. The house keeps 5%.

const AH_CUT = 0.05;

export type BookRow = { itemId: number; p10: number; quantity: number };

export type ItemName = { name: string; icon: string | null };

export type Deal = {
  itemId: number;
  name: string;
  icon: string | null;
  // Which house you buy on. The other house is where you list.
  direction: "alliance-neutral" | "neutral-alliance";
  buy: number;
  sell: number;
  receive: number;
  edge: number;
  buyQty: number;
  sellQty: number;
};

// Same rounding as the cycles edge. Half a copper rounds up.
function receive(sell: number): number {
  return Math.floor(sell * (1 - AH_CUT) + 0.5);
}

function side(buy: number, sell: number, buyQty: number, sellQty: number) {
  const got = receive(sell);
  return { buy, sell, receive: got, edge: got - buy, buyQty, sellQty };
}

// One row per item. The 5% cut means both directions cannot be profitable at once.
export function findDeals(
  alliance: BookRow[],
  neutral: BookRow[],
  names: Map<number, ItemName>,
): Deal[] {
  const other = new Map(neutral.map((row) => [row.itemId, row]));
  const deals: Deal[] = [];

  for (const row of alliance) {
    const match = other.get(row.itemId);
    if (!match) continue;
    if (!(row.p10 > 0) || !(match.p10 > 0)) continue;

    const toNeutral = side(row.p10, match.p10, row.quantity, match.quantity);
    const toAlliance = side(match.p10, row.p10, match.quantity, row.quantity);
    // The positive side is the only one worth listing. A tie loses the cut.
    const chosen = toNeutral.edge > 0 ? toNeutral : toAlliance.edge > 0 ? toAlliance : null;
    if (!chosen) continue;

    const named = names.get(row.itemId);
    deals.push({
      itemId: row.itemId,
      name: named?.name ?? "",
      icon: named?.icon ?? null,
      direction: chosen === toNeutral ? "alliance-neutral" : "neutral-alliance",
      ...chosen,
    });
  }

  deals.sort((a, b) => b.edge - a.edge || a.itemId - b.itemId);
  return deals;
}
