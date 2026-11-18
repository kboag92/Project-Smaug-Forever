// Vanilla enchanting materials, keyed by Blizzard item id.
// A tier is the liquid staple of that bracket: the dust, the greater essence,
// and the large shard. Tier 5 uses Nexus Crystal, because Illusion Dust has no large shard.
// Lesser essences and small shards stay in the "all" baskets and out of the tier baskets.

export type MatKind = "dust" | "essence" | "shard" | "crystal";

export type EnchantMat = {
  itemId: number;
  name: string;
  kind: MatKind;
  tier: number;
  // True for the three items that define that tier's index.
  staple: boolean;
};

function mat(itemId: number, name: string, kind: MatKind, tier: number, staple: boolean): EnchantMat {
  return { itemId, name, kind, tier, staple };
}

// Dust, then greater essence, then lesser essence, then large shard, then small shard, then the crystal.
// Tier baskets keep this order, so Tier 1 reads Strange Dust, Greater Magic Essence, Large Glimmering Shard.
export const MATS: EnchantMat[] = [
  mat(10940, "Strange Dust", "dust", 1, true),
  mat(11083, "Soul Dust", "dust", 2, true),
  mat(11137, "Vision Dust", "dust", 3, true),
  mat(11176, "Dream Dust", "dust", 4, true),
  mat(16204, "Illusion Dust", "dust", 5, true),

  mat(10939, "Greater Magic Essence", "essence", 1, true),
  mat(11082, "Greater Astral Essence", "essence", 2, true),
  mat(11135, "Greater Mystic Essence", "essence", 3, true),
  mat(11175, "Greater Nether Essence", "essence", 4, true),
  mat(16203, "Greater Eternal Essence", "essence", 5, true),

  mat(10938, "Lesser Magic Essence", "essence", 1, false),
  mat(10998, "Lesser Astral Essence", "essence", 2, false),
  mat(11134, "Lesser Mystic Essence", "essence", 3, false),
  mat(11174, "Lesser Nether Essence", "essence", 4, false),
  mat(16202, "Lesser Eternal Essence", "essence", 5, false),

  mat(11084, "Large Glimmering Shard", "shard", 1, true),
  mat(11139, "Large Glowing Shard", "shard", 2, true),
  mat(11178, "Large Radiant Shard", "shard", 3, true),
  mat(14344, "Large Brilliant Shard", "shard", 4, true),

  mat(10978, "Small Glimmering Shard", "shard", 1, false),
  mat(11138, "Small Glowing Shard", "shard", 2, false),
  mat(11177, "Small Radiant Shard", "shard", 3, false),
  mat(14343, "Small Brilliant Shard", "shard", 4, false),

  mat(20725, "Nexus Crystal", "crystal", 5, true),
];

export type BasketDef = { id: string; name: string; members: EnchantMat[] };

// Page order: the four whole-market baskets, then Tier 1 through Tier 5.
export function baskets(): BasketDef[] {
  const list: BasketDef[] = [
    { id: "all", name: "All enchanting materials", members: MATS },
    { id: "shards", name: "All shards", members: MATS.filter((row) => row.kind === "shard") },
    { id: "dust", name: "All dust", members: MATS.filter((row) => row.kind === "dust") },
    { id: "essences", name: "All essences", members: MATS.filter((row) => row.kind === "essence") },
  ];
  for (let tier = 1; tier <= 5; tier += 1) {
    list.push({
      id: "tier-" + tier,
      name: "Tier " + tier,
      members: MATS.filter((row) => row.staple && row.tier === tier),
    });
  }
  return list;
}

export function itemIds(): number[] {
  return MATS.map((row) => row.itemId);
}
