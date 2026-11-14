import { fetchAccessToken, fetchHouseBook, fetchHouseIndex, fetchItemProfile } from "./blizzard/client.js";
import { stacksFromBook } from "./blizzard/parse.js";
import { scanConfig } from "./config.js";
import { loadLocalEnv, requireEnv } from "./env.js";
import { aggregateMarkets } from "./process/aggregate.js";
import { factionFromName, pickHouses, type HouseCandidate } from "./process/pick-houses.js";
import { createDatabase, markHouseUnlisted, recordFailedScan, saveMarkets, upsertHouse } from "./store/database.js";
import { findUnnamedItemIds, listKnownHouses, markNameAttempts, saveItems } from "./store/items.js";

// One pass: read the configured factions, keep the fullest unique book, store the four datapoints.
async function main(): Promise<void> {
  loadLocalEnv();

  const client = {
    token: await fetchAccessToken(requireEnv("BNET_CLIENT_ID"), requireEnv("BNET_CLIENT_SECRET")),
    region: scanConfig.region,
    locale: scanConfig.locale,
  };
  const db = createDatabase(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  const index = await fetchHouseIndex(client, scanConfig.rulesetId);
  const fetched: HouseCandidate[] = [];

  for (const entry of index) {
    const faction = factionFromName(entry.name);
    if (!faction) {
      console.log(`Skipping house ${entry.id} (${entry.name}): faction is unknown.`);
      continue;
    }
    // Horde and Blackwater are not downloaded when they are absent from scanConfig.factions.
    if (!scanConfig.factions.includes(faction)) {
      console.log(`Skipping house ${entry.id} (${entry.name}): ${faction} is not in this scan.`);
      continue;
    }

    try {
      const book = await fetchHouseBook(client, scanConfig.rulesetId, entry.id);
      const parsed = stacksFromBook(book.auctions, book.commodities);
      fetched.push({
        blizzardId: entry.id,
        name: entry.name,
        faction,
        listingIds: parsed.listingIds,
        stacks: parsed.stacks,
      });
      console.log(`${entry.name} (${entry.id}): ${parsed.stacks.length} priced stacks.`);
    } catch (error) {
      console.error(`Failed to read house ${entry.id}:`, error);
      await noteFailedHouse(db, entry.id, entry.name, faction);
    }
  }

  const chosen = pickHouses(fetched);
  const chosenIds = new Set(chosen.map((house) => house.blizzardId));
  console.log(`Storing ${chosen.length} house(s): ${chosen.map((house) => house.name).join(", ") || "none"}.`);

  let savedHouses = 0;
  const seenItemIds = new Set<number>();

  for (const house of chosen) {
    const scannedAt = new Date();
    let houseId: number | null = null;
    try {
      houseId = await upsertHouse(db, {
        region: scanConfig.region,
        rulesetId: scanConfig.rulesetId,
        blizzardId: house.blizzardId,
        name: house.name,
        faction: house.faction,
      });
      const markets = aggregateMarkets(house.stacks);
      await saveMarkets(db, houseId, markets, scannedAt, scanConfig.dailyRetentionDays);
      for (const market of markets) seenItemIds.add(market.itemId);
      savedHouses += 1;
      console.log(`Saved ${markets.length} items for ${house.name}.`);
    } catch (error) {
      console.error(`Failed to save ${house.name}:`, error);
      if (houseId != null) await tryRecordFailure(db, houseId, scannedAt);
    }
  }

  await retireSkippedHouses(db, fetched, chosenIds);
  await storeNewItemNames(db, client, [...seenItemIds]);

  if (chosen.length > 0 && savedHouses === 0) {
    throw new Error("Every chosen house failed to save.");
  }
}

// A read error still leaves a failed scan when we already know this house.
async function noteFailedHouse(
  db: ReturnType<typeof createDatabase>,
  blizzardId: number,
  name: string,
  faction: HouseCandidate["faction"],
): Promise<void> {
  try {
    const houseId = await upsertHouse(db, {
      region: scanConfig.region,
      rulesetId: scanConfig.rulesetId,
      blizzardId,
      name,
      faction,
    });
    await recordFailedScan(db, houseId, new Date());
  } catch (error) {
    console.error("Could not record the failed scan:", error);
  }
}

async function tryRecordFailure(
  db: ReturnType<typeof createDatabase>,
  houseId: number,
  scannedAt: Date,
): Promise<void> {
  try {
    await recordFailedScan(db, houseId, scannedAt);
  } catch (error) {
    console.error("Could not record the failed scan:", error);
  }
}

// Houses we read but did not keep (empty or a duplicate book) should not stay "listed".
async function retireSkippedHouses(
  db: ReturnType<typeof createDatabase>,
  fetched: HouseCandidate[],
  chosenIds: Set<number>,
): Promise<void> {
  const fetchedIds = new Set(fetched.map((house) => house.blizzardId));
  try {
    const known = await listKnownHouses(db, scanConfig.region, scanConfig.rulesetId);
    for (const house of known) {
      if (chosenIds.has(house.blizzardId) || !fetchedIds.has(house.blizzardId)) continue;
      await markHouseUnlisted(db, house.id, new Date());
      console.log(`Marked house ${house.blizzardId} unlisted because this scan did not keep it.`);
    }
  } catch (error) {
    console.error("Could not retire skipped houses:", error);
  }
}

// Names are filled in slowly. A lookup failure does not undo the prices already saved.
async function storeNewItemNames(
  db: ReturnType<typeof createDatabase>,
  client: { token: string; region: string; locale: string },
  itemIds: number[],
): Promise<void> {
  try {
    const missing = await findUnnamedItemIds(db, itemIds, scanConfig.itemNameBudget);
    const profiles = [];
    const failed: number[] = [];
    for (const itemId of missing) {
      try {
        profiles.push(await fetchItemProfile(client, itemId));
      } catch (error) {
        failed.push(itemId);
        console.error(`Item ${itemId} name lookup failed:`, error);
      }
    }
    if (profiles.length > 0) {
      await saveItems(db, profiles);
      console.log(`Stored names for ${profiles.length} items.`);
    }
    // Record the miss so this id is not first in line again while others are still unasked.
    await markNameAttempts(db, failed);
    if (failed.length > 0) console.log(`Recorded ${failed.length} failed name lookups.`);
  } catch (error) {
    console.error("Item name pass failed:", error);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
