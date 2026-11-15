import { findDeals } from "./arbitrage.js";

// The plain page script calls this after both books have loaded.
const target = globalThis as typeof globalThis & { Arbitrage?: { findDeals: typeof findDeals } };
target.Arbitrage = { findDeals };
