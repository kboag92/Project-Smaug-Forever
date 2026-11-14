import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ItemMarket } from "../process/aggregate.js";
import type { Faction } from "../process/pick-houses.js";

// Rows per request. A full house can be thousands of items, which is too large for one body.
const CHUNK = 500;

export type HouseIdentity = {
  region: string;
  rulesetId: number;
  blizzardId: number;
  name: string;
  faction: Faction;
};

type QueryError = { message: string } | null;

function raise(error: QueryError): void {
  if (error) throw new Error(error.message);
}

function chunks<T>(rows: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    batches.push(rows.slice(index, index + size));
  }
  return batches;
}

// Copper fits in a JavaScript number for any real auction price.
// Refuse a value that cannot round-trip through JSON safely.
function toNumber(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} is too large to store.`);
  }
  return Number(value);
}

// Floor to the 15-minute window so a rerun updates the same scan row.
export function bucketScanTime(when: Date): string {
  const windowMs = 15 * 60 * 1000;
  return new Date(Math.floor(when.getTime() / windowMs) * windowMs).toISOString();
}

// The Supabase client adds /rest/v1 itself. A URL that already ends in /rest/v1
// becomes /rest/v1/rest/v1, which the API rejects as an invalid path.
export function projectUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
}

export function createDatabase(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(projectUrl(url), serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function upsertHouse(db: SupabaseClient, house: HouseIdentity): Promise<number> {
  const { data, error } = await db
    .from("houses")
    .upsert(
      {
        region: house.region,
        ruleset_id: house.rulesetId,
        blizzard_id: house.blizzardId,
        name: house.name,
        faction: house.faction,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "region,ruleset_id,blizzard_id" },
    )
    .select("id")
    .single();

  raise(error);
  if (!data) throw new Error("House upsert returned no id.");
  return data.id as number;
}

// Write the four live fields, one row per scan, and today's daily summary.
// A failed scan must not call this. Last good prices stay listed.
// scan_prices rows are kept. dailyRetentionDays only trims the daily summary.
export async function saveMarkets(
  db: SupabaseClient,
  houseId: number,
  markets: ItemMarket[],
  scannedAt: Date,
  dailyRetentionDays: number,
): Promise<void> {
  const scannedIso = scannedAt.toISOString();
  // toISOString is UTC, so the first ten characters are the UTC day.
  const day = scannedIso.slice(0, 10);

  const latestRows = markets.map((market) => ({
    house_id: houseId,
    item_id: market.itemId,
    p10_price: toNumber(market.p10Price, "p10"),
    median_price: toNumber(market.medianPrice, "median"),
    quantity: market.quantity,
    average_price: toNumber(market.averagePrice, "average"),
    is_listed: true,
    scanned_at: scannedIso,
  }));

  const dailyRows = markets.map((market) => ({
    house_id: houseId,
    item_id: market.itemId,
    day,
    p10_price: toNumber(market.p10Price, "p10"),
    median_price: toNumber(market.medianPrice, "median"),
    quantity: market.quantity,
    average_price: toNumber(market.averagePrice, "average"),
    p10_low: toNumber(market.p10Price, "p10"),
  }));

  // Same four numbers, kept once per scan instead of overwritten.
  // scanned_at here is the real clock time, not the quarter-hour bucket.
  const scanRows = markets.map((market) => ({
    house_id: houseId,
    item_id: market.itemId,
    scanned_at: scannedIso,
    p10_price: toNumber(market.p10Price, "p10"),
    median_price: toNumber(market.medianPrice, "median"),
    quantity: market.quantity,
    average_price: toNumber(market.averagePrice, "average"),
  }));

  for (const batch of chunks(latestRows, CHUNK)) {
    const { error } = await db.from("latest_prices").upsert(batch, { onConflict: "house_id,item_id" });
    raise(error);
  }

  for (const batch of chunks(dailyRows, CHUNK)) {
    const { error } = await db.rpc("upsert_daily_prices", { rows: batch });
    raise(error);
  }

  for (const batch of chunks(scanRows, CHUNK)) {
    const { error } = await db.from("scan_prices").upsert(batch, {
      onConflict: "house_id,item_id,scanned_at",
    });
    raise(error);
  }

  const { error: unlistError } = await db.rpc("mark_unlisted", {
    target_house_id: houseId,
    seen_at: scannedIso,
  });
  raise(unlistError);

  await recordScan(db, houseId, scannedAt, markets.length, "success");

  // Cleanup is bookkeeping for the daily summary only. scan_prices is not trimmed.
  const { error: trimError } = await db.rpc("delete_old_daily_prices", { keep_days: dailyRetentionDays });
  if (trimError) console.error("Daily cleanup failed:", trimError.message);
}

// The house was read, but we are not keeping it (empty, or a duplicate book).
// Clear its listed flags without inventing new prices.
export async function markHouseUnlisted(db: SupabaseClient, houseId: number, scannedAt: Date): Promise<void> {
  const { error } = await db.rpc("mark_unlisted", {
    target_house_id: houseId,
    seen_at: scannedAt.toISOString(),
  });
  raise(error);
  await recordScan(db, houseId, scannedAt, 0, "success");
}

export async function recordFailedScan(db: SupabaseClient, houseId: number, scannedAt: Date): Promise<void> {
  await recordScan(db, houseId, scannedAt, 0, "failed");
}

async function recordScan(
  db: SupabaseClient,
  houseId: number,
  scannedAt: Date,
  itemCount: number,
  status: "success" | "failed",
): Promise<void> {
  const { error } = await db.from("scans").upsert(
    {
      house_id: houseId,
      scanned_at: bucketScanTime(scannedAt),
      item_count: itemCount,
      status,
    },
    { onConflict: "house_id,scanned_at" },
  );
  raise(error);
}
