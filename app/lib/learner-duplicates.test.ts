import assert from "node:assert/strict";
import test from "node:test";

import {
  findLearnerDuplicate,
  normalizeLearnerIdentifier,
} from "./learner-duplicates";

const existing = [
  {
    id: "learner-1",
    name: "Lebo",
    legal_name: "Lebo Molefe",
    date_of_birth: "2021-05-05",
    birth_certificate_number: "BC-123 456",
    sa_id_number: "210505-5300-086",
    passport_number: null,
  },
];

test("normalizes punctuation and case in learner identifiers", () => {
  assert.equal(normalizeLearnerIdentifier(" ab-12 3 "), "AB123");
});

test("blocks a matching official identifier", () => {
  const result = findLearnerDuplicate(
    {
      legalName: "Different Learner",
      dateOfBirth: "2020-01-01",
      birthCertificateNumber: "",
      saIdNumber: "2105055300086",
      passportNumber: "",
    },
    existing
  );

  assert.equal(result?.kind, "identifier");
  assert.equal(result?.field, "SA ID number");
});

test("warns when legal name and date of birth match", () => {
  const result = findLearnerDuplicate(
    {
      legalName: "  LEBO   MOLEFE ",
      dateOfBirth: "2021-05-05",
      birthCertificateNumber: "",
      saIdNumber: "",
      passportNumber: "",
    },
    existing
  );

  assert.equal(result?.kind, "identity");
});

test("does not match the learner currently being edited", () => {
  const result = findLearnerDuplicate(
    {
      legalName: "Lebo Molefe",
      dateOfBirth: "2021-05-05",
      birthCertificateNumber: "BC123456",
      saIdNumber: "",
      passportNumber: "",
    },
    existing,
    "learner-1"
  );

  assert.equal(result, null);
});
