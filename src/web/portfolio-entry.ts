import { scorePortfolio, shiftUtcDay, utcToday } from "./portfolio-value.js";

// The plain page script calls this after the daily rows have loaded.
const target = globalThis as typeof globalThis & {
  PortfolioValue?: {
    scorePortfolio: typeof scorePortfolio;
    shiftUtcDay: typeof shiftUtcDay;
    utcToday: typeof utcToday;
  };
};
target.PortfolioValue = { scorePortfolio, shiftUtcDay, utcToday };
