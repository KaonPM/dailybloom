# WhatsApp enrolment setup

DailyBloom uses WhatsApp only for **new enrolment** communication. Existing parent-portal re-enrolment remains unchanged.

## 1. Connect the WhatsApp sender

In Meta Business Manager:

1. Select **Lesedi Smart Solutions** and the approved WhatsApp Business Account.
2. Add or connect the DailyBloom business phone number. Its status must be connected, rather than offline.
3. Create a dedicated system user for DailyBloom and give it WhatsApp Business Account access.
4. Create a long-lived system-user access token. Keep it private; never place it in browser code or share it in chat.

## 2. Create the approved templates

Create the following three templates. The first two are **Utility** templates. The code template is an **Authentication** template.

| Purpose | Template category | Suggested template name | Parameters |
| --- | --- | --- | --- |
| Registration payment request | Utility | `dailybloom_enrolment_registration` | Parent name, school name, registration fee, enrolment reference, bank details |
| Secure enrolment-form link | Utility | `dailybloom_enrolment_form` | Parent name, school name, enrolment reference, secure form link, link-validity period |
| Form access code | Authentication | `dailybloom_enrolment_access_code` | Six-digit code only |

### Registration payment request — Utility

Suggested wording:

> Hello {{1}}, thank you for enquiring at {{2}}. The registration fee is {{3}}. Use {{4}} as your payment reference. Banking details: {{5}}. After payment is confirmed, you will receive a secure digital enrolment form.

### Secure enrolment-form link — Utility

Suggested wording:

> Hello {{1}}, your enrolment form {{3}} for {{2}} is ready. Open {{4}} within {{5}}. We will send a WhatsApp access code before the form opens.

Add a **URL button** that opens:

```text
https://dailybloom.co.za/enrolment/{{1}}
```

DailyBloom supplies the secure token for the dynamic part of this link.

### Form access code — Authentication

Create this in Meta as an **Authentication** template, not a Utility or Marketing template:

- Choose the **Copy Code** OTP button.
- Enable Meta's security recommendation.
- Set the code expiry in the template footer to **10 minutes**.
- DailyBloom supplies only the six-digit code as `{{1}}`.

Do not add a parent name, school name, payment details or other personal information to this template. The earlier Utility form-link message identifies the school and enrolment; the Authentication message verifies access only.

Meta approval is required before any template can be sent outside the normal customer-service window.

## 3. Add the environment variables in Vercel

In **Vercel → DailyBloom → Settings → Environment Variables**, add these values for Production and Preview where appropriate:

```text
WHATSAPP_API_VERSION=vXX.X
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_private_system_user_token
WHATSAPP_BUSINESS_ACCOUNT_ID=your_whatsapp_business_account_id
WHATSAPP_TEMPLATE_ENROLMENT_REGISTRATION=dailybloom_enrolment_registration
WHATSAPP_TEMPLATE_ENROLMENT_FORM=dailybloom_enrolment_form
WHATSAPP_TEMPLATE_ENROLMENT_ACCESS_CODE=dailybloom_enrolment_access_code
WHATSAPP_TEMPLATE_ENROLMENT_REGISTRATION_VERSION=1
WHATSAPP_TEMPLATE_ENROLMENT_FORM_VERSION=1
WHATSAPP_TEMPLATE_ENROLMENT_ACCESS_CODE_VERSION=1
WHATSAPP_TEMPLATE_ENROLMENT_REGISTRATION_APPROVED_AT=YYYY-MM-DD
WHATSAPP_TEMPLATE_ENROLMENT_FORM_APPROVED_AT=YYYY-MM-DD
WHATSAPP_TEMPLATE_ENROLMENT_ACCESS_CODE_APPROVED_AT=YYYY-MM-DD
WHATSAPP_TEMPLATE_ENROLMENT_REGISTRATION_META_ID=your_meta_template_id
WHATSAPP_TEMPLATE_ENROLMENT_FORM_META_ID=your_meta_template_id
WHATSAPP_TEMPLATE_ENROLMENT_ACCESS_CODE_META_ID=your_meta_template_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=a_long_random_secret
WHATSAPP_APP_SECRET=your_meta_app_secret
ENROLMENT_DELIVERY_ENCRYPTION_KEY=a_private_32_byte_base64_key
CRON_SECRET=a_long_random_secret
```

Never put the access token or app secret in `NEXT_PUBLIC_*` variables, Supabase tables, screenshots or WhatsApp messages.

`WHATSAPP_BUSINESS_ACCOUNT_ID` is not needed for the current message-send endpoint, but recording it now prepares DailyBloom for future WhatsApp management and reporting. The `WHATSAPP_TEMPLATE_...` names are now preferred. The older `WHATSAPP_ENROLMENT_..._TEMPLATE` names remain supported temporarily, so renaming the Vercel variables will not interrupt current enrolment messages.

Each template records its name, version, Meta template ID and approval date in DailyBloom's delivery history. When wording changes, update the relevant version and approval-date variables before sending with the new Meta-approved template.

## 4. Configure the webhook

In the Meta App Dashboard, configure this callback URL:

```text
https://dailybloom.co.za/api/whatsapp/webhook
```

Use the same value for `WHATSAPP_WEBHOOK_VERIFY_TOKEN`. Subscribe to WhatsApp message status updates so DailyBloom can show whether a template was sent, delivered, read or failed.

## 5. Security behaviour in DailyBloom

- A form link expires after **24 hours**.
- The WhatsApp authentication code expires after **10 minutes**.
- Parents can resend the code after one minute, with a controlled maximum number of sends per form link.
- Incorrect-code attempts are limited and temporarily lock the link after repeated failures.
- A successful verification creates a secure browser session that permits the form only for the remaining link-validity period.
- The code, verified session and webhook signatures are stored or checked securely; a browser never receives WhatsApp credentials.
- If a parent opens an expired or already-used link, DailyBloom shows a clear explanation and asks them to contact the school for a fresh link instead of exposing technical details.

## 6. Delivery retries and enrolment message history

DailyBloom records every enrolment WhatsApp attempt under its enrolment record. This lets authorised school staff see the template, version, send time, delivery/read status, retry time and final error where applicable.

- Utility messages (registration and form-link messages) retry only after a temporary Meta failure: approximately **30 seconds**, then **2 minutes**, then **10 minutes** later.
- After the final unsuccessful attempt, the message is marked **Failed** and staff can resend it from the enrolment record.
- Authentication codes are deliberately **not retried automatically**. They are short-lived security credentials; the parent can request another code after one minute.
- The Vercel retry cron runs each minute, so a retry may occur up to one additional minute after its scheduled time.

Before enabling retries, apply `supabase/migrations/20260811_enrolment_whatsapp_delivery_history.sql` and set `ENROLMENT_DELIVERY_ENCRYPTION_KEY` plus `CRON_SECRET` in Vercel.

## 7. Test before using it with parents

1. Add the approved templates and environment values.
2. Create a test enquiry using a staff-controlled mobile number.
3. Confirm the Utility registration message arrives with the correct reference and bank details.
4. Confirm the Utility form-link message opens the correct enrolment link.
5. Request the code and confirm Meta sends the **Authentication** Copy Code message.
6. Verify that a wrong code is rejected, the correct code opens the form, and the code cannot be reused after it expires.
7. Confirm webhook delivery status appears in DailyBloom before using it for a parent.
