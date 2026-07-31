export type DuplicateLearnerCandidate = {
  id: string;
  name?: string | null;
  legal_name?: string | null;
  date_of_birth?: string | null;
  birth_certificate_number?: string | null;
  sa_id_number?: string | null;
  passport_number?: string | null;
};

export type DuplicateLearnerInput = {
  legalName: string;
  dateOfBirth: string;
  birthCertificateNumber: string;
  saIdNumber: string;
  passportNumber: string;
};

export type LearnerDuplicateMatch =
  | {
      kind: "identifier";
      field: "SA ID number" | "passport number" | "birth certificate number";
      learner: DuplicateLearnerCandidate;
    }
  | {
      kind: "identity";
      field: "full legal name and date of birth";
      learner: DuplicateLearnerCandidate;
    };

export function normalizeLearnerIdentifier(value?: string | null) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function normalizeLearnerName(value?: string | null) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("en-ZA")
    .replace(/\s+/g, " ");
}

export function findLearnerDuplicate(
  input: DuplicateLearnerInput,
  learners: DuplicateLearnerCandidate[],
  excludedLearnerId?: string
): LearnerDuplicateMatch | null {
  const availableLearners = learners.filter(
    (learner) => learner.id !== excludedLearnerId
  );

  const identifiers = [
    {
      field: "SA ID number" as const,
      input: input.saIdNumber,
      key: "sa_id_number" as const,
    },
    {
      field: "passport number" as const,
      input: input.passportNumber,
      key: "passport_number" as const,
    },
    {
      field: "birth certificate number" as const,
      input: input.birthCertificateNumber,
      key: "birth_certificate_number" as const,
    },
  ];

  for (const identifier of identifiers) {
    const normalizedInput = normalizeLearnerIdentifier(identifier.input);
    if (!normalizedInput) continue;

    const learner = availableLearners.find(
      (candidate) =>
        normalizeLearnerIdentifier(candidate[identifier.key]) === normalizedInput
    );
    if (learner) {
      return {
        kind: "identifier",
        field: identifier.field,
        learner,
      };
    }
  }

  const normalizedLegalName = normalizeLearnerName(input.legalName);
  if (!normalizedLegalName || !input.dateOfBirth) return null;

  const learner = availableLearners.find(
    (candidate) =>
      normalizeLearnerName(candidate.legal_name) === normalizedLegalName &&
      candidate.date_of_birth === input.dateOfBirth
  );

  return learner
    ? {
        kind: "identity",
        field: "full legal name and date of birth",
        learner,
      }
    : null;
}

export function duplicateLearnerDisplayName(
  learner: DuplicateLearnerCandidate
) {
  return learner.legal_name || learner.name || "the existing learner";
}
