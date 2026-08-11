import "server-only";

import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";

export const FORM_LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const FORM_ACCESS_CODE_LIFETIME_MS = 10 * 60 * 1000;
export const FORM_ACCESS_SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function hashEnrolmentSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createEnrolmentAccessCode() {
  return String(randomInt(100000, 1000000));
}

export function createEnrolmentAccessSession() {
  return randomBytes(32).toString("base64url");
}

export function accessCookieName(token: string) {
  return `db_enrolment_access_${hashEnrolmentSecret(token).slice(0, 18)}`;
}

export function hasMatchingSecret(value: string, storedHash: string | null | undefined) {
  if (!value || !storedHash) return false;
  const actual = Buffer.from(hashEnrolmentSecret(value));
  const expected = Buffer.from(storedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function readRequestCookie(request: Request, name: string) {
  const source = request.headers.get("cookie") || "";
  const prefix = `${name}=`;
  return source.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length) || "";
}
