export const STANDARD_LEARNER_DOCUMENTS = [
  {
    name: "Birth Certificate",
    aliases: ["Birth Certificate"],
  },
  {
    name: "Immunisation / Clinic Card",
    aliases: [
      "Immunisation / Clinic Card",
      "Immunisation Card",
      "Immunisation Card (Clinic Card)",
      "Clinic Card",
    ],
  },
  {
    name: "Parent/Guardian ID",
    aliases: ["Parent/Guardian ID", "Parent / Guardian ID", "Guardian ID"],
  },
  {
    name: "Signed Parent/Guardian Enrolment Contract",
    aliases: [
      "Signed Parent/Guardian Enrolment Contract",
      "Signed Enrolment Contract",
      "Enrolment Contract",
      "Enrollment Contract",
      "Parent Contract",
      "Contract",
    ],
  },
] as const;

function normalizeDocumentName(value?: string | null) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ");
}

const CANONICAL_DOCUMENT_NAMES = new Map(
  STANDARD_LEARNER_DOCUMENTS.flatMap((document) =>
    document.aliases.map((alias) => [
      normalizeDocumentName(alias),
      document.name,
    ] as const)
  )
);

export function canonicalLearnerDocumentName(value?: string | null) {
  const trimmedValue = (value || "").trim().replace(/\s+/g, " ");

  return (
    CANONICAL_DOCUMENT_NAMES.get(normalizeDocumentName(trimmedValue)) ||
    trimmedValue
  );
}

export function learnerDocumentNamesMatch(
  first?: string | null,
  second?: string | null
) {
  return (
    normalizeDocumentName(canonicalLearnerDocumentName(first)) ===
    normalizeDocumentName(canonicalLearnerDocumentName(second))
  );
}
