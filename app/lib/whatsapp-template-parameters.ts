export type EnrolmentWhatsAppKind = "registration" | "form" | "access_code";

export function enrolmentWhatsAppBodyParameters(kind: EnrolmentWhatsAppKind, values: string[]) {
  const parentName = values[0] || "";
  const schoolName = values[1] || "";
  if (kind === "form") return [schoolName, parentName, values[2] || "", values[3] || "", values[4] || "72 hours"];
  if (kind === "registration") return [parentName, schoolName, values[2] || "", values[3] || "", values[4] || ""];
  return values;
}
