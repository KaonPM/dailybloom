import assert from "node:assert/strict";
import test from "node:test";
import { awardDefinitions, getAwardDefinition } from "./award-types";

test("award names are unique and fully configured", () => {
  const names = awardDefinitions.map((award) => award.name);
  assert.equal(new Set(names).size, names.length);
  for (const award of awardDefinitions) {
    assert.ok(award.category);
    assert.ok(award.subtitle);
    assert.ok(award.reasons.length > 0);
  }
});

test("returns the shared definition used by certificate forms", () => {
  const award = getAwardDefinition("Certificate of Achievement");
  assert.equal(award?.category, "Academic");
  assert.ok(award?.reasons.includes("Outstanding academic achievement"));
});
