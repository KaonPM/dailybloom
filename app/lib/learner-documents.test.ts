import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalLearnerDocumentName,
  learnerDocumentNamesMatch,
  STANDARD_LEARNER_DOCUMENTS,
} from "./learner-documents";

test("uses one canonical immunisation document name", () => {
  assert.equal(
    canonicalLearnerDocumentName("Immunisation Card (Clinic Card)"),
    "Immunisation / Clinic Card"
  );
  assert.equal(
    canonicalLearnerDocumentName("Immunisation Card"),
    "Immunisation / Clinic Card"
  );
  assert.equal(
    learnerDocumentNamesMatch("Clinic Card", "Immunisation / Clinic Card"),
    true
  );
});

test("uses one canonical contract and guardian ID name", () => {
  assert.equal(
    canonicalLearnerDocumentName("Contract"),
    "Signed Parent/Guardian Enrolment Contract"
  );
  assert.equal(
    learnerDocumentNamesMatch("Parent / Guardian ID", "Parent/Guardian ID"),
    true
  );
});

test("keeps school-specific extra documents unchanged", () => {
  assert.equal(
    canonicalLearnerDocumentName("Proof of Address"),
    "Proof of Address"
  );
});

test("defines the four standard learner documents", () => {
  assert.deepEqual(
    STANDARD_LEARNER_DOCUMENTS.map((document) => document.name),
    [
      "Birth Certificate",
      "Immunisation / Clinic Card",
      "Parent/Guardian ID",
      "Signed Parent/Guardian Enrolment Contract",
    ]
  );
});
