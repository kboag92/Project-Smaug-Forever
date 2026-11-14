import { createHash } from "node:crypto";
import type { PricedStack } from "./aggregate.js";

// Faction is read from the house name Blizzard sends ("Horde Auction House", and so on).
export type Faction = "alliance" | "horde" | "blackwater";

export type HouseCandidate = {
  blizzardId: number;
  name: string;
  faction: Faction;
  listingIds: number[];
  stacks: PricedStack[];
};

// Blackwater is checked first because the name does not contain the other factions.
export function factionFromName(name: string): Faction | null {
  const lower = name.toLowerCase();
  if (lower.includes("blackwater")) return "blackwater";
  if (lower.includes("alliance")) return "alliance";
  if (lower.includes("horde")) return "horde";
  return null;
}

// Same listing ids mean the same book, even when Blizzard repeats it under another house id.
export function listingHash(listingIds: number[]): string {
  // Sort so the same ids in a different order still count as one book.
  const ordered = [...listingIds].sort((a, b) => a - b);
  return createHash("sha256").update(ordered.join(",")).digest("hex");
}

function sizeOf(house: HouseCandidate): number {
  return house.stacks.length;
}

// Keep the fullest non-empty house for each faction.
// Then drop a house whose listing ids match one we already kept.
export function pickHouses(houses: HouseCandidate[]): HouseCandidate[] {
  const fullest = new Map<Faction, HouseCandidate>();

  for (const house of houses) {
    if (house.stacks.length === 0) continue;
    const current = fullest.get(house.faction);
    const fuller =
      current == null ||
      sizeOf(house) > sizeOf(current) ||
      (sizeOf(house) === sizeOf(current) && house.blizzardId < current.blizzardId);
    if (fuller) fullest.set(house.faction, house);
  }

  // Larger books win the duplicate check, so a small copy cannot replace a big one.
  const winners = [...fullest.values()].sort(
    (a, b) => sizeOf(b) - sizeOf(a) || a.blizzardId - b.blizzardId,
  );
  const seen = new Set<string>();
  const kept: HouseCandidate[] = [];

  for (const house of winners) {
    const hash = listingHash(house.listingIds);
    if (seen.has(hash)) continue;
    seen.add(hash);
    kept.push(house);
  }

  return kept;
}
