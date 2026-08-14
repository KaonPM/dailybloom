import crypto from "crypto";

const PENDING_PIN_LIFETIME_SECONDS = 10 * 60;

function parentCookieSecret() {
  const secret =
    process.env.PARENT_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Parent session signing is not configured.");
  return secret;
}

function sign(value: string) {
  return crypto
    .createHmac("sha256", parentCookieSecret())
    .update(value)
    .digest("base64url");
}

export function createPendingParentChallenge(phone: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + PENDING_PIN_LIFETIME_SECONDS;
  const payload = Buffer.from(JSON.stringify({ phone, expiresAt })).toString(
    "base64url"
  );
  return `${payload}.${sign(payload)}`;
}

export function verifyPendingParentChallenge(value: string) {
  const [payload, receivedSignature, extra] = value.split(".");
  if (!payload || !receivedSignature || extra) return null;
  const expectedSignature = sign(payload);
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(received, expected)
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      phone?: unknown;
      expiresAt?: unknown;
    };
    const phone = typeof parsed.phone === "string" ? parsed.phone : "";
    const expiresAt = Number(parsed.expiresAt || 0);
    return /^0\d{9}$/.test(phone) && expiresAt > Math.floor(Date.now() / 1000)
      ? phone
      : null;
  } catch {
    return null;
  }
}
