export type EnrolmentWhatsAppKind = "registration" | "form" | "access_code";

export function enrolmentWhatsAppBodyParameters(kind: EnrolmentWhatsAppKind, values: string[]) {
  const parentName = values[0] || "";
  const schoolName = values[1] || "";
  if (kind === "form") return [schoolName, parentName, values[2] || "", values[3] || "", values[4] || "72 hours"];
  // Meta's approved registration template uses {{1}} for the preschool and
  // {{2}} for the parent, even though the rendered greeting reads parent first.
  if (kind === "registration") return [schoolName, parentName, values[2] || "", values[3] || "", values[4] || ""];
  return values;
}
