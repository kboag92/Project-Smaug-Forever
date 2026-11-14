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

export type NameAttempt = { name: string | null; fetchedAt: string | null };

// Never-requested ids come first. A failed id is stored with a null name, and it
// waits until every id from this scan has been requested at least once.
export function pickNameLookups(
  itemIds: number[],
  known: Map<number, NameAttempt>,
  budget: number,
): number[] {
  const unseen: number[] = [];
  const failed: { id: number; fetchedAt: string }[] = [];
  for (const itemId of itemIds) {
    const row = known.get(itemId);
    if (!row) unseen.push(itemId);
    else if (!row.name) failed.push({ id: itemId, fetchedAt: row.fetchedAt ?? "" });
  }
  if (unseen.length > 0) return unseen.slice(0, budget);
  failed.sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt) || a.id - b.id);
  return failed.slice(0, budget).map((row) => row.id);
}

export async function findUnnamedItemIds(
  db: SupabaseClient,
  itemIds: number[],
  budget: number,
): Promise<number[]> {
  const known = new Map<number, NameAttempt>();

  for (const batch of chunks(itemIds, 200)) {
    const { data, error } = await db.from("items").select("id, name, fetched_at").in("id", batch);
    raise(error);
    for (const row of data ?? []) {
      known.set(row.id as number, {
        name: (row.name as string | null) ?? null,
        fetchedAt: (row.fetched_at as string | null) ?? null,
      });
    }
  }

  return pickNameLookups(itemIds, known, budget);
}

// A failed lookup still counts as requested, so the next scan can move on.
export async function markNameAttempts(db: SupabaseClient, itemIds: number[]): Promise<void> {
  if (itemIds.length === 0) return;
  const fetchedAt = new Date().toISOString();
  const { error } = await db.from("items").upsert(
    itemIds.map((id) => ({ id, name: null, fetched_at: fetchedAt })),
    { onConflict: "id" },
  );
  raise(error);
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
