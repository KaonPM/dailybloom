import "server-only";

export function toSouthAfricanSmsNumber(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `27${digits.slice(1)}`;
  return digits;
}

async function getSmsPortalToken() {
  const clientId = process.env.SMSPORTAL_CLIENT_ID;
  const clientSecret = process.env.SMSPORTAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("SMS service is not configured.");
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://rest.smsportal.com/v1/authentication", {
    headers: { Authorization: `Basic ${credentials}` }, cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok || !result?.token) throw new Error(result?.message || "SMS authentication failed.");
  return result.token as string;
}

export async function sendSms(phone: string, message: string) {
  const destination = toSouthAfricanSmsNumber(phone);
  if (!/^27\d{9}$/.test(destination)) throw new Error("Invalid South African mobile number.");
  const token = await getSmsPortalToken();
  const response = await fetch("https://rest.smsportal.com/v1/bulkmessages", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: [{ content: message, destination }] }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.message || "SMS sending failed.");
  return { providerMessageId: String(result?.batchId || result?.id || "") || null };
}
