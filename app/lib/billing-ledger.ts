import "server-only";
import { Resend } from "resend";
import { supabaseAdmin } from "./supabase-admin";
import { getPlanPrice } from "./plan-rules";

export const DAILYBLOOM_SETUP_FEE = Number(
  process.env.DAILYBLOOM_SETUP_FEE || 599
);

type InvoiceRow = {
  id: string;
  school_id: number;
  invoice_number: string;
  charge_type: "setup_fee" | "subscription";
  description: string;
  plan_name: string | null;
  issue_date: string;
  due_date: string;
  period_start: string | null;
  period_end: string | null;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  download_token: string;
  exemption_reason?: string | null;
  exempted_at?: string | null;
};

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthEnd(year: number, monthIndex: number) {
  return dateOnly(new Date(Date.UTC(year, monthIndex + 1, 0)));
}

function invoiceNumber(schoolId: number, date: Date) {
  const stamp = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}${String(date.getUTCDate()).padStart(2, "0")}`;
  return `DB-${stamp}-${schoolId}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

async function currentSubscription(schoolId: number) {
  const { data, error } = await supabaseAdmin
    .from("school_subscriptions")
    .select("id, school_id, plan_name, monthly_price, status")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureSubscription(schoolId: number) {
  const existing = await currentSubscription(schoolId);
  if (existing) return existing;

  const { data: school, error: schoolError } = await supabaseAdmin
    .from("schools")
    .select("package_name")
    .eq("id", schoolId)
    .single();
  if (schoolError) throw schoolError;

  const planName = String(school.package_name || "Bloom");
  const now = new Date();
  const nextBillingDate = dateOnly(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  );
  const { data, error } = await supabaseAdmin
    .from("school_subscriptions")
    .upsert(
      {
        school_id: schoolId,
        plan_name: planName,
        monthly_price: getPlanPrice(planName),
        status: "active",
        start_date: dateOnly(now),
        next_billing_date: nextBillingDate,
        updated_at: now.toISOString(),
      },
      { onConflict: "school_id" }
    )
    .select("id, school_id, plan_name, monthly_price, status")
    .single();
  if (error) throw error;

  await supabaseAdmin
    .from("schools")
    .update({ billing_status: "active" })
    .eq("id", schoolId);
  return data;
}

export async function activateSubscriptionBilling(
  schoolId: number,
  activationDate = new Date()
) {
  const subscription = await ensureSubscription(schoolId);
  const nextBillingDate = dateOnly(
    new Date(
      Date.UTC(
        activationDate.getUTCFullYear(),
        activationDate.getUTCMonth() + 1,
        1
      )
    )
  );
  const { error } = await supabaseAdmin
    .from("school_subscriptions")
    .update({
      status: "active",
      next_billing_date: nextBillingDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);
  if (error) throw error;

  await supabaseAdmin
    .from("schools")
    .update({ billing_status: "active" })
    .eq("id", schoolId);

  return { ...subscription, status: "active", next_billing_date: nextBillingDate };
}

async function schoolBillingContact(schoolId: number) {
  const [{ data: school, error: schoolError }, { data: contacts, error: contactError }] =
    await Promise.all([
      supabaseAdmin
        .from("schools")
        .select("id, school_name, package_name, setup_fee_amount")
        .eq("id", schoolId)
        .single(),
      supabaseAdmin
        .from("profiles")
        .select("full_name, email, role")
        .eq("school_id", schoolId)
        .in("role", ["owner", "principal"])
        .eq("is_active", true)
        .order("role", { ascending: true })
        .limit(1),
    ]);

  if (schoolError) throw schoolError;
  if (contactError) throw contactError;

  return {
    school,
    contact: contacts?.[0] || null,
  };
}

export async function createSetupFeeInvoice(
  schoolId: number,
  setupDate?: string | null
) {
  const { school } = await schoolBillingContact(schoolId);
  const subscription = await ensureSubscription(schoolId);
  const planName = String(
    subscription?.plan_name || school.package_name || "Bloom"
  );
  const parsedSetupDate = setupDate
    ? new Date(`${setupDate.slice(0, 10)}T00:00:00.000Z`)
    : null;
  const now =
    parsedSetupDate && !Number.isNaN(parsedSetupDate.getTime())
      ? parsedSetupDate
      : new Date();
  const issueDate = dateOnly(now);
  const dueDate = dateOnly(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7))
  );
  const hasConfiguredSetupFee =
    school.setup_fee_amount !== null &&
    school.setup_fee_amount !== undefined &&
    school.setup_fee_amount !== "";
  const configuredSetupFee = Number(school.setup_fee_amount);
  const total =
    hasConfiguredSetupFee &&
    Number.isFinite(configuredSetupFee) &&
    configuredSetupFee >= 0
      ? configuredSetupFee
      : DAILYBLOOM_SETUP_FEE;

  const { data, error } = await supabaseAdmin
    .from("billing_invoices")
    .upsert(
      {
        school_id: schoolId,
        subscription_id: subscription?.id || null,
        invoice_number: invoiceNumber(schoolId, now),
        external_key: `setup:${schoolId}`,
        charge_type: "setup_fee",
        description: `DailyBloom Setup Fee — ${planName} Package`,
        plan_name: planName,
        issue_date: issueDate,
        due_date: dueDate,
        subtotal: total,
        vat_amount: 0,
        total_amount: total,
        balance_due: total,
        status: "issued",
      },
      { onConflict: "external_key", ignoreDuplicates: true }
    )
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (data) {
    const credited = await applyAvailableCredit(data as InvoiceRow);
    return reconcileHistoricalSetupPayment(credited);
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("billing_invoices")
    .select("*")
    .eq("external_key", `setup:${schoolId}`)
    .single();
  if (existingError) throw existingError;
  return reconcileHistoricalSetupPayment(existing as InvoiceRow);
}

async function reconcileHistoricalSetupPayment(invoice: InvoiceRow) {
  if (
    invoice.charge_type !== "setup_fee" ||
    invoice.exempted_at ||
    Number(invoice.total_amount || 0) <= 0
  ) {
    return invoice;
  }

  const { data: existingAllocations, error: allocationReadError } =
    await supabaseAdmin
      .from("billing_payment_allocations")
      .select("payment_id, amount")
      .eq("invoice_id", invoice.id);
  if (allocationReadError) throw allocationReadError;

  if ((existingAllocations || []).length > 0) {
    const paymentIds = (existingAllocations || []).map((row) => row.payment_id);
    await supabaseAdmin
      .from("subscription_payments")
      .update({
        charge_type: "setup_fee",
        plan_name: invoice.plan_name,
      })
      .in("id", paymentIds);
    return invoice;
  }

  const [{ data: payments, error: paymentError }, { data: allAllocations, error: allAllocationError }] =
    await Promise.all([
      supabaseAdmin
        .from("subscription_payments")
        .select("id, amount, payment_date")
        .eq("school_id", invoice.school_id)
        .order("payment_date", { ascending: true })
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("billing_payment_allocations")
        .select("payment_id"),
    ]);
  if (paymentError) throw paymentError;
  if (allAllocationError) throw allAllocationError;

  const allocatedPaymentIds = new Set(
    (allAllocations || []).map((row) => Number(row.payment_id))
  );
  const historicalPayment = (payments || []).find(
    (payment) =>
      !allocatedPaymentIds.has(Number(payment.id)) &&
      Number(payment.amount || 0) > 0
  );
  if (!historicalPayment) return invoice;

  const allocationAmount = Math.min(
    Number(historicalPayment.amount),
    Number(invoice.total_amount)
  );
  const balanceDue = Math.max(0, Number(invoice.total_amount) - allocationAmount);
  const status = balanceDue === 0 ? "paid" : "partially_paid";

  const { error: allocationError } = await supabaseAdmin
    .from("billing_payment_allocations")
    .insert({
      payment_id: historicalPayment.id,
      invoice_id: invoice.id,
      amount: allocationAmount,
    });
  if (allocationError) throw allocationError;

  const { error: paymentUpdateError } = await supabaseAdmin
    .from("subscription_payments")
    .update({
      charge_type: "setup_fee",
      plan_name: invoice.plan_name,
      unapplied_amount: Math.max(
        0,
        Number(historicalPayment.amount) - allocationAmount
      ),
    })
    .eq("id", historicalPayment.id);
  if (paymentUpdateError) throw paymentUpdateError;

  const { data: updated, error: invoiceUpdateError } = await supabaseAdmin
    .from("billing_invoices")
    .update({
      amount_paid: allocationAmount,
      balance_due: balanceDue,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice.id)
    .select("*")
    .single();
  if (invoiceUpdateError) throw invoiceUpdateError;
  return updated as InvoiceRow;
}

export async function reconcileSetupFeeInvoices() {
  const [{ data: schools, error: schoolError }, { data: existing, error: invoiceError }] =
    await Promise.all([
      supabaseAdmin
        .from("schools")
        .select("id, status, is_active, activated_at, created_at"),
      supabaseAdmin
        .from("billing_invoices")
        .select("school_id")
        .eq("charge_type", "setup_fee"),
    ]);
  if (schoolError) throw schoolError;
  if (invoiceError) throw invoiceError;

  const existingSchoolIds = new Set(
    (existing || []).map((invoice) => Number(invoice.school_id))
  );
  const missingSchools = (schools || []).filter(
    (school) => !existingSchoolIds.has(Number(school.id))
  );

  const created: InvoiceRow[] = [];
  if (missingSchools.length > 0) {
    const schoolIds = missingSchools.map((school) => Number(school.id));
    const { data: onboarding, error: onboardingError } = await supabaseAdmin
      .from("school_onboarding")
      .select("school_id, setup_date")
      .in("school_id", schoolIds);
    if (onboardingError) throw onboardingError;
    const setupDates = new Map(
      (onboarding || []).map((row) => [
        Number(row.school_id),
        row.setup_date ? String(row.setup_date) : null,
      ])
    );

    for (const school of missingSchools) {
      const schoolId = Number(school.id);
      const setupDate =
        (school.created_at ? String(school.created_at).slice(0, 10) : null) ||
        setupDates.get(schoolId) ||
        (school.activated_at
          ? String(school.activated_at).slice(0, 10)
          : null) ||
        null;
      created.push(await createSetupFeeInvoice(schoolId, setupDate));
    }
  }

  const { data: setupInvoices, error: setupInvoiceError } = await supabaseAdmin
    .from("billing_invoices")
    .select("*")
    .eq("charge_type", "setup_fee");
  if (setupInvoiceError) throw setupInvoiceError;
  for (const invoice of setupInvoices || []) {
    await reconcileHistoricalSetupPayment(invoice as InvoiceRow);
  }

  const now = new Date();
  const upcomingFirst = dateOnly(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  );
  const { error: billingDateError } = await supabaseAdmin
    .from("school_subscriptions")
    .update({
      next_billing_date: upcomingFirst,
      updated_at: now.toISOString(),
    })
    .in("status", ["active", "trial"])
    .lt("next_billing_date", upcomingFirst);
  if (billingDateError) throw billingDateError;

  return created;
}

export async function createMonthlySubscriptionInvoice(
  schoolId: number,
  billingDate = new Date()
) {
  const subscription = await currentSubscription(schoolId);
  if (!subscription || !["active", "trial"].includes(String(subscription.status))) {
    return null;
  }

  const year = billingDate.getUTCFullYear();
  const monthIndex = billingDate.getUTCMonth();
  const periodStart = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const periodEnd = monthEnd(year, monthIndex);
  const total = Number(subscription.monthly_price || 0);
  const planName = String(subscription.plan_name || "Bloom");

  const { data, error } = await supabaseAdmin
    .from("billing_invoices")
    .upsert(
      {
        school_id: schoolId,
        subscription_id: subscription.id,
        invoice_number: invoiceNumber(schoolId, billingDate),
        external_key: `subscription:${schoolId}:${year}-${String(
          monthIndex + 1
        ).padStart(2, "0")}`,
        charge_type: "subscription",
        description: `${planName} Subscription Package — ${billingDate.toLocaleString(
          "en-ZA",
          { month: "long", year: "numeric", timeZone: "UTC" }
        )}`,
        plan_name: planName,
        issue_date: periodStart,
        due_date: periodStart,
        period_start: periodStart,
        period_end: periodEnd,
        subtotal: total,
        vat_amount: 0,
        total_amount: total,
        balance_due: total,
        status: "issued",
      },
      { onConflict: "external_key", ignoreDuplicates: true }
    )
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const nextMonth = new Date(Date.UTC(year, monthIndex + 1, 1));
  await supabaseAdmin
    .from("school_subscriptions")
    .update({
      next_billing_date: dateOnly(nextMonth),
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);

  return applyAvailableCredit(data as InvoiceRow);
}

export async function generateMonthlyInvoices(billingDate = new Date()) {
  const { data: subscriptions, error } = await supabaseAdmin
    .from("school_subscriptions")
    .select("school_id")
    .in("status", ["active", "trial"]);
  if (error) throw error;

  const results = [];
  for (const subscription of subscriptions || []) {
    const invoice = await createMonthlySubscriptionInvoice(
      Number(subscription.school_id),
      billingDate
    );
    if (invoice) results.push(invoice);
  }
  return results;
}

export async function sendInvoiceEmail(invoice: InvoiceRow) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { sent: false, reason: "Missing Resend API key." };

  const { school, contact } = await schoolBillingContact(invoice.school_id);
  if (!contact?.email) {
    return { sent: false, reason: "No active principal or owner email found." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const documentUrl = `${appUrl}/api/billing/invoices/document?token=${invoice.download_token}`;
  const resend = new Resend(resendApiKey);
  const { error } = await resend.emails.send({
    from:
      process.env.DAILYBLOOM_FROM_EMAIL ||
      "DailyBloom <onboarding@resend.dev>",
    to: contact.email,
    subject: `${invoice.invoice_number} — ${invoice.description}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#FFF8F2;padding:24px;color:#2D2A3E">
        <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #F0E3D8;border-radius:18px;padding:26px">
          <h1 style="margin:0 0 8px">Daily<span style="color:#FF5EA8">Bloom</span></h1>
          <p>Hello ${escapeHtml(contact.full_name || "Principal")},</p>
          <p>${invoice.exempted_at ? "A setup-fee exemption invoice" : "A new invoice"} is available for <strong>${escapeHtml(
            school.school_name || "your preschool"
          )}</strong>.</p>
          <div style="background:#EAF7FD;border:1px solid #CBEAF7;border-radius:14px;padding:16px;margin:20px 0">
            <p><strong>Invoice:</strong> ${escapeHtml(invoice.invoice_number)}</p>
            <p><strong>Description:</strong> ${escapeHtml(invoice.description)}</p>
            <p><strong>Amount:</strong> R${Number(invoice.total_amount).toFixed(2)}</p>
            <p><strong>Due:</strong> ${escapeHtml(invoice.due_date)}</p>
            ${
              invoice.exempted_at
                ? `<p><strong>Setup fee:</strong> Exempted</p><p><strong>Reason:</strong> ${escapeHtml(invoice.exemption_reason || "Approved exemption")}</p>`
                : ""
            }
          </div>
          <p><a href="${escapeHtml(
            documentUrl
          )}" style="display:inline-block;background:#75C7EA;color:#fff;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:12px">Open invoice</a></p>
          <p style="color:#6F6880;font-size:13px">DailyBloom is not currently registered for VAT. No VAT has been charged.</p>
        </div>
      </div>`,
  });

  if (error) return { sent: false, reason: error.message };

  await supabaseAdmin
    .from("billing_invoices")
    .update({ emailed_at: new Date().toISOString() })
    .eq("id", invoice.id);

  return { sent: true };
}

async function applyAvailableCredit(invoice: InvoiceRow) {
  if (Number(invoice.balance_due || 0) <= 0) return invoice;

  const { data: credits, error } = await supabaseAdmin
    .from("subscription_payments")
    .select("id, unapplied_amount")
    .eq("school_id", invoice.school_id)
    .gt("unapplied_amount", 0)
    .order("payment_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;

  let paid = Number(invoice.amount_paid || 0);
  let balance = Number(invoice.balance_due || 0);

  for (const credit of credits || []) {
    if (balance <= 0) break;
    const available = Number(credit.unapplied_amount || 0);
    const allocation = Math.min(available, balance);
    if (allocation <= 0) continue;

    const { error: allocationError } = await supabaseAdmin
      .from("billing_payment_allocations")
      .insert({
        payment_id: credit.id,
        invoice_id: invoice.id,
        amount: allocation,
      });
    if (allocationError) throw allocationError;

    const { error: paymentError } = await supabaseAdmin
      .from("subscription_payments")
      .update({ unapplied_amount: available - allocation })
      .eq("id", credit.id);
    if (paymentError) throw paymentError;

    paid += allocation;
    balance -= allocation;
  }

  if (paid === Number(invoice.amount_paid || 0)) return invoice;

  const status = balance <= 0 ? "paid" : "partially_paid";
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("billing_invoices")
    .update({
      amount_paid: paid,
      balance_due: Math.max(0, balance),
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice.id)
    .select("*")
    .single();
  if (updateError) throw updateError;
  return updated as InvoiceRow;
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
