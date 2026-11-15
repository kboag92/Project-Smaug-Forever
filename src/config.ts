// Default market for the scanner.
// Europe is a one-line change: region "eu" and locale "en_GB".
// Ruleset 1 is PvP. 2 is Normal, 3 is Roleplay, 15 is Roleplay PvP.
// factions is which side to download. houseId is the Alliance book to store.
// neutralHouseId is the Blackwater book. US PvP has five of each.
// 110 matched the in-game Alliance house. 116 matched the neutral house.
export const scanConfig = {
  region: "us",
  rulesetId: 1,
  locale: "en_US",
  factions: ["alliance", "blackwater"],
  houseId: 110,
  neutralHouseId: 116,
  // Neutral scan rows and daily rows older than this are deleted.
  // Alliance scan history is kept. Alliance daily rows use dailyRetentionDays.
  neutralRetentionDays: 3,
  // New item names fetched per run. The static API is one request per item,
  // plus one for the icon, so a small budget keeps each scan short.
  itemNameBudget: 40,
  // Daily rows older than this are deleted so the free database stays under 500 MB.
  dailyRetentionDays: 90,
};
