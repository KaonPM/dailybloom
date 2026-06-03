type SendLoginEmailParams = {
  toEmail: string;
  fullName: string;
  temporaryPassword: string;
  roleLabel: string;
};

export async function sendLoginEmail({
  toEmail,
  fullName,
  temporaryPassword,
  roleLabel,
}: SendLoginEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.DAILYBLOOM_FROM_EMAIL || "DailyBloom <onboarding@resend.dev>";
  const loginUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://dailybloom.co.za";

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject: "Your DailyBloom login details",
      html: `
        <div style="font-family: Arial, sans-serif; color: #101828; line-height: 1.6;">
          <h2>Your DailyBloom login details</h2>

          <p>Dear ${fullName},</p>

          <p>Your DailyBloom ${roleLabel} account has been created.</p>

          <p>
            <strong>Login page:</strong>
            <a href="${loginUrl}/login">${loginUrl}/login</a>
          </p>

          <p>
            <strong>Login email:</strong> ${toEmail}<br />
            <strong>Temporary password:</strong> ${temporaryPassword}
          </p>

          <p>
            For your security, please change this password immediately after your first login.
          </p>

          <p>
            Your new password must be at least 8 characters long and include letters, numbers, and a special character.
          </p>

          <p>Kind regards,<br />DailyBloom Team</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Could not send login email.");
  }

  return true;
}