import type { SupabaseClient } from "@supabase/supabase-js";

// Drop one house's scan rows and daily rows after keepDays.
// The caller passes the neutral house only. Alliance history is not trimmed here.
// A missing function is logged. The prices just saved stay in place.
export async function trimHouseHistory(db: SupabaseClient, houseId: number, keepDays: number): Promise<void> {
  const { error } = await db.rpc("delete_house_history", {
    target_house_id: houseId,
    keep_days: keepDays,
  });
  if (error) console.error("House history cleanup failed:", error.message);
}
