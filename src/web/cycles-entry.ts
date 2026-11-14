import { findCycles } from "./cycles.js";

// The plain page script calls this after it has loaded the scan rows.
const target = globalThis as typeof globalThis & { CycleScore?: { findCycles: typeof findCycles } };
target.CycleScore = { findCycles };
