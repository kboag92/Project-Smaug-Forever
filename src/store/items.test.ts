import assert from "node:assert/strict";
import test from "node:test";
import { pickNameLookups, type NameAttempt } from "./items.js";

const named = (name: string): NameAttempt => ({ name, fetchedAt: "2026-11-14T00:00:00Z" });
const missed = (fetchedAt: string): NameAttempt => ({ name: null, fetchedAt });

test("name lookups skip ids that were already requested while any id is still new", () => {
  const known = new Map<number, NameAttempt>([
    [647, missed("2026-11-14T00:00:00Z")],
    [2589, named("Linen Cloth")],
  ]);
  const picked = pickNameLookups([647, 720, 2589, 4306], known, 40);
  assert.deepEqual(picked, [720, 4306]);
});

test("failed ids are retried only after every id has been requested", () => {
  const known = new Map<number, NameAttempt>([
    [647, missed("2026-11-14T03:00:00Z")],
    [720, missed("2026-11-14T01:00:00Z")],
    [2589, named("Linen Cloth")],
  ]);
  const picked = pickNameLookups([647, 720, 2589], known, 1);
  assert.deepEqual(picked, [720]);
});
