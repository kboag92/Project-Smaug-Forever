import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemProfile } from "../blizzard/client.js";

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

// Item ids that still have no name, capped at the per-run budget.
// A row with a null name still counts as missing, so a failed lookup is retried later.
export async function findUnnamedItemIds(
  db: SupabaseClient,
  itemIds: number[],
  budget: number,
): Promise<number[]> {
  const named = new Set<number>();

  for (const batch of chunks(itemIds, 200)) {
    const { data, error } = await db.from("items").select("id, name").in("id", batch);
    raise(error);
    for (const row of data ?? []) {
      if (row.name) named.add(row.id as number);
    }
  }

  const missing: number[] = [];
  for (const itemId of itemIds) {
    if (named.has(itemId)) continue;
    missing.push(itemId);
    if (missing.length >= budget) break;
  }
  return missing;
}

export async function saveItems(db: SupabaseClient, items: ItemProfile[]): Promise<void> {
  if (items.length === 0) return;
  const fetchedAt = new Date().toISOString();
  const { error } = await db.from("items").upsert(
    items.map((item) => ({ ...item, fetched_at: fetchedAt })),
    { onConflict: "id" },
  );
  raise(error);
}

// Houses already stored for this region and ruleset. Used to clear ones we no longer keep.
export async function listKnownHouses(
  db: SupabaseClient,
  region: string,
  rulesetId: number,
): Promise<{ id: number; blizzardId: number }[]> {
  const { data, error } = await db
    .from("houses")
    .select("id, blizzard_id")
    .eq("region", region)
    .eq("ruleset_id", rulesetId);
  raise(error);
  return (data ?? []).map((row) => ({
    id: row.id as number,
    blizzardId: row.blizzard_id as number,
  }));
}
