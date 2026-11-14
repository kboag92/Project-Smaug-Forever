import assert from "node:assert/strict";
import test from "node:test";
import { configSource } from "./site-config.js";

test("site config keeps only the publishable key it was given", () => {
  const source = configSource("https://example.supabase.co/rest/v1/", "sb_publishable_example");
  assert.match(source, /https:\/\/example\.supabase\.co/);
  assert.match(source, /sb_publishable_example/);
  assert.doesNotMatch(source, /rest\/v1/);
  assert.doesNotMatch(source, /service_role/);
});
