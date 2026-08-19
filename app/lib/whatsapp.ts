import "server-only";

import { toSouthAfricanSmsNumber } from "@/app/lib/sms-portal";

type WhatsAppTemplateInput = {
  templateName: string;
  phone: string;
  headerParameters?: string[];
  bodyParameters: string[];
  buttonUrl?: string;
};

type WhatsAppAuthenticationCodeInput = {
  templateName: string;
  phone: string;
  code: string;
};

export type EnrolmentWhatsAppKind = "registration" | "form" | "access_code";

export type WhatsAppSendResult = {
  providerMessageId: string | null;
};

export type EnrolmentWhatsAppTemplateDetails = {
  templateName: string;
  templateVersion: string;
  category: "utility" | "authentication";
  approvedAt: string | null;
  metaTemplateId: string | null;
};

/** A Meta response that may be safely retried for Utility notifications only. */
export class WhatsAppSendError extends Error {
  readonly status: number;
  readonly isRetryable: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = "WhatsAppSendError";
    this.status = status;
    this.isRetryable = status === 408 || status === 429 || status >= 500;
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`WhatsApp is not configured. Add ${name} in Vercel before sending enrolment messages.`);
  return value;
}

function enrolmentTemplateEnvironment(preferredName: string, legacyName: string) {
  const preferredValue = process.env[preferredName]?.trim();
  if (preferredValue) return preferredValue;

  const legacyValue = process.env[legacyName]?.trim();
  if (legacyValue) return legacyValue;

  throw new Error(
    `WhatsApp enrolment template is not configured. Add ${preferredName} (preferred) or ${legacyName}.`,
  );
}

function enrolmentTemplateEnvironmentNames(kind: EnrolmentWhatsAppKind) {
  if (kind === "registration") {
    return {
      preferred: "WHATSAPP_TEMPLATE_ENROLMENT_REGISTRATION",
      legacy: "WHATSAPP_ENROLMENT_REGISTRATION_TEMPLATE",
      metadataPrefix: "WHATSAPP_TEMPLATE_ENROLMENT_REGISTRATION",
      category: "utility" as const,
    };
  }
  if (kind === "form") {
    return {
      preferred: "WHATSAPP_TEMPLATE_ENROLMENT_FORM",
      legacy: "WHATSAPP_ENROLMENT_FORM_TEMPLATE",
      metadataPrefix: "WHATSAPP_TEMPLATE_ENROLMENT_FORM",
      category: "utility" as const,
    };
  }
  return {
    preferred: "WHATSAPP_TEMPLATE_ENROLMENT_ACCESS_CODE",
    legacy: "WHATSAPP_ENROLMENT_ACCESS_CODE_TEMPLATE",
    metadataPrefix: "WHATSAPP_TEMPLATE_ENROLMENT_ACCESS_CODE",
    category: "authentication" as const,
  };
}

export function getEnrolmentWhatsAppTemplateDetails(kind: EnrolmentWhatsAppKind): EnrolmentWhatsAppTemplateDetails {
  const names = enrolmentTemplateEnvironmentNames(kind);
  return {
    templateName: kind === "registration"
      ? "dailybloom_enrolment_registration"
      : kind === "form"
        ? "dailybloom_enrolment_form"
        : enrolmentTemplateEnvironment(names.preferred, names.legacy),
    templateVersion: process.env[`${names.metadataPrefix}_VERSION`]?.trim() || "1",
    category: names.category,
    approvedAt: process.env[`${names.metadataPrefix}_APPROVED_AT`]?.trim() || null,
    metaTemplateId: process.env[`${names.metadataPrefix}_META_ID`]?.trim() || null,
  };
}

function cleanTemplateParameter(value: string) {
  return value.replace(/\r?\n/g, " ").trim().slice(0, 1024);
}

function formUrlToken(value: string) {
  try {
    const token = new URL(value).pathname.split("/").filter(Boolean).pop();
    return token || value;
  } catch {
    return value;
  }
}

export function isWhatsAppEnrolmentConfigured() {
  return Boolean(
    process.env.WHATSAPP_API_VERSION?.trim()
      && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
      && process.env.WHATSAPP_ACCESS_TOKEN?.trim(),
  );
}

function templateLanguage() {
  return process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";
}

function logTemplateDispatch(input: { templateName: string; language: string; headerParameterCount: number; bodyParameterCount: number }) {
  console.info("WhatsApp template dispatch", input);
}

export async function sendWhatsAppTemplate(input: WhatsAppTemplateInput): Promise<WhatsAppSendResult> {
  const apiVersion = requiredEnvironment("WHATSAPP_API_VERSION");
  const phoneNumberId = requiredEnvironment("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = requiredEnvironment("WHATSAPP_ACCESS_TOKEN");
  const to = toSouthAfricanSmsNumber(input.phone).replace(/^\+/, "");
  if (!/^27\d{9}$/.test(to)) throw new Error("Enter a valid 10-digit South African mobile number, for example 082 000 0000.");
  const language = templateLanguage();

  const components: Array<Record<string, unknown>> = [];
  if (input.headerParameters?.length) {
    components.push({
      type: "header",
      parameters: input.headerParameters.map((value) => ({ type: "text", text: cleanTemplateParameter(value) })),
    });
  }
  if (input.bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: input.bodyParameters.map((value) => ({ type: "text", text: cleanTemplateParameter(value) })),
    });
  }
  if (input.buttonUrl) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: cleanTemplateParameter(input.buttonUrl) }],
    });
  }
  logTemplateDispatch({
    templateName: input.templateName,
    language,
    headerParameterCount: input.headerParameters?.length || 0,
    bodyParameterCount: input.bodyParameters.length,
  });

  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: language },
        components,
      },
    }),
  });

  const body = await response.json().catch(() => ({})) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string; error_user_msg?: string };
  };
  if (!response.ok) {
    const message = body.error?.error_user_msg || body.error?.message || "WhatsApp delivery could not be completed.";
    throw new WhatsAppSendError(message, response.status);
  }

  return { providerMessageId: body.messages?.[0]?.id || null };
}

/**
 * Authentication templates use Meta's fixed OTP structure. The code is the
 * only dynamic value; parent and school details belong in the preceding
 * Utility message, never in an identity-verification message.
 */
export async function sendWhatsAppAuthenticationCode(input: WhatsAppAuthenticationCodeInput): Promise<WhatsAppSendResult> {
  const apiVersion = requiredEnvironment("WHATSAPP_API_VERSION");
  const phoneNumberId = requiredEnvironment("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = requiredEnvironment("WHATSAPP_ACCESS_TOKEN");
  const to = toSouthAfricanSmsNumber(input.phone).replace(/^\+/, "");
  if (!/^27\d{9}$/.test(to)) throw new Error("Enter a valid 10-digit South African mobile number, for example 082 000 0000.");
  const code = cleanTemplateParameter(input.code);
  const language = templateLanguage();
  logTemplateDispatch({ templateName: input.templateName, language, headerParameterCount: 0, bodyParameterCount: 1 });

  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: language },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
  });

  const body = await response.json().catch(() => ({})) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string; error_user_msg?: string };
  };
  if (!response.ok) {
    const message = body.error?.error_user_msg || body.error?.message || "WhatsApp access-code delivery could not be completed.";
    throw new WhatsAppSendError(message, response.status);
  }

  return { providerMessageId: body.messages?.[0]?.id || null };
}

export async function sendEnrolmentWhatsApp(input: {
  kind: EnrolmentWhatsAppKind;
  phone: string;
  bodyParameters: string[];
  accessCode?: string;
}) {
  const templateName = getEnrolmentWhatsAppTemplateDetails(input.kind).templateName;
  const usesSchoolHeader = input.kind === "registration" || input.kind === "form";

  if (input.kind === "access_code") {
    const code = input.accessCode || input.bodyParameters[2];
    if (!code) {
      throw new Error("An enrolment access code is required before it can be sent.");
    }
    return sendWhatsAppAuthenticationCode({
      templateName,
      phone: input.phone,
      code,
    });
  }

  return sendWhatsAppTemplate({
    templateName,
    phone: input.phone,
    headerParameters: usesSchoolHeader ? [input.bodyParameters[1] || ""] : undefined,
    bodyParameters: input.kind === "form"
      // Meta Utility template body: school, parent, reference, full secure link, expiry.
      ? [input.bodyParameters[1] || "", input.bodyParameters[0] || "", input.bodyParameters[2] || "", input.bodyParameters[3] || "", input.bodyParameters[4] || "24 hours"]
      : input.kind === "registration"
        // Meta Utility template body: parent, school, fee, payment reference, banking details.
        ? [input.bodyParameters[0] || "", input.bodyParameters[1] || "", input.bodyParameters[2] || "", input.bodyParameters[3] || "", input.bodyParameters[4] || ""]
        : input.bodyParameters,
    // Meta dynamic URL buttons append this value to the fixed URL configured in the template.
    buttonUrl: input.kind === "form" && input.bodyParameters[3]
      ? formUrlToken(input.bodyParameters[3])
      : undefined,
  });
}
