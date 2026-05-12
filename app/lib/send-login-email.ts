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
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.DAILYBLOOM_FROM_EMAIL || "noreply@dailybloom.co.za";

  if (!apiKey) {
    throw new Error("Missing BREVO_API_KEY.");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: "Daily Bloom",
        email: fromEmail,
      },
      to: [
        {
          email: toEmail,
          name: fullName,
        },
      ],
      subject: "Your Daily Bloom Login Details",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; color: #101828; line-height: 1.6;">
          <h2>Your Daily Bloom Login Details</h2>

          <p>Dear ${fullName},</p>

          <p>Your Daily Bloom ${roleLabel} account has been created.</p>

          <p>
            <strong>Login email:</strong> ${toEmail}<br />
            <strong>Temporary password:</strong> ${temporaryPassword}
          </p>

          <p>
            For your security, you will be asked to change this password immediately after your first login.
          </p>

          <p>
            Your new password must be at least 8 characters long and must include letters, numbers, and a special character.
          </p>

          <p>Kind regards,<br />Daily Bloom</p>
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