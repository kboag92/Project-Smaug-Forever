import { rankSuggestions } from "./suggest-rank.js";

// The plain page script calls this after the user types in a search box.
const target = globalThis as typeof globalThis & {
  SuggestRank?: { rank: typeof rankSuggestions };
};
target.SuggestRank = { rank: rankSuggestions };
