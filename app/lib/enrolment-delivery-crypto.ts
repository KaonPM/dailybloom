import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

type RetryPayload = {
  phone: string;
  bodyParameters: string[];
};

function encryptionKey() {
  const configured = process.env.ENROLMENT_DELIVERY_ENCRYPTION_KEY?.trim();
  if (!configured) return null;
  try {
    const key = Buffer.from(configured, "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

/** Stores only encrypted Utility-template retry data. OTPs are never encrypted or queued. */
export function encryptEnrolmentDeliveryPayload(payload: RetryPayload) {
  const key = encryptionKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptEnrolmentDeliveryPayload(value: string) {
  const key = encryptionKey();
  if (!key) return null;
  try {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    if (!ivValue || !tagValue || !encryptedValue) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64"));
    const json = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64")), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(json) as RetryPayload;
    return typeof parsed.phone === "string" && Array.isArray(parsed.bodyParameters) ? parsed : null;
  } catch {
    return null;
  }
}
