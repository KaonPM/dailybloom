import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";

export function hashParentSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function getParentSessionHash() {
  const token = (await cookies()).get("parent_session")?.value;
  return token ? hashParentSessionToken(token) : null;
}
