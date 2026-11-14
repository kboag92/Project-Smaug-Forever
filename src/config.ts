// Default market for the scanner.
// Europe is a one-line change: region "eu" and locale "en_GB".
// Ruleset 1 is PvP. 2 is Normal, 3 is Roleplay, 15 is Roleplay PvP.
// factions is which side to keep. houseId is the Blizzard auction house to store.
// US PvP has five Alliance houses. 110 is the one that matched the in-game search.
export const scanConfig = {
  region: "us",
  rulesetId: 1,
  locale: "en_US",
  factions: ["alliance"],
  houseId: 110,
  // New item names fetched per run. The static API is one request per item,
  // plus one for the icon, so a small budget keeps each scan short.
  itemNameBudget: 40,
  // Daily rows older than this are deleted so the free database stays under 500 MB.
  dailyRetentionDays: 90,
};
