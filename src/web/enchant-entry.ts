import { itemIds } from "./enchant-mats.js";
import { scoreBaskets, shiftUtcDay, utcToday } from "./enchant-index.js";

// The plain page script calls this after the daily rows have loaded.
const target = globalThis as typeof globalThis & {
  EnchantIndex?: {
    itemIds: typeof itemIds;
    scoreBaskets: typeof scoreBaskets;
    shiftUtcDay: typeof shiftUtcDay;
    utcToday: typeof utcToday;
  };
};
target.EnchantIndex = { itemIds, scoreBaskets, shiftUtcDay, utcToday };
