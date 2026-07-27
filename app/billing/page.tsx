"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BillingInvoicesPanel from "./invoices/BillingInvoicesPanel";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { PERMISSIONS } from "../lib/permissions";

type School = {
  id: number;
  school_name: string | null;
};

type Subscription = {
  id: number;
  school_id: number;
  plan_name: string;
  monthly_price: number;
  status: string;
  start_date: string | null;
  next_billing_date: string | null;
  last_payment_date: string | null;
  schools?: School | null;
};

type Profile = {
  id: string;
  role: string;
  school_id: number | null;
  permissions?: string[] | null;
};

const PLAN_OPTIONS = [
  { name: "Bloom", price: 299 },
  { name: "Bloom Pro", price: 399 },
  { name: "Bloom Elite", price: 499 },
];

const STATUS_OPTIONS = ["trial", "active", "overdue", "cancelled"];

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSchoolId = searchParams.get("school") || "";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("Bloom");
  const [selectedStatus, setSelectedStatus] = useState("trial");
  const [nextBillingDate, setNextBillingDate] = useState("");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentChargeType, setPaymentChargeType] = useState<
    "setup_fee" | "subscription"
  >("subscription");
  const [paymentMethod, setPaymentMethod] = useState("EFT");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [paymentNotes, setPaymentNotes] = useState("");
  const [activePaymentSubscription, setActivePaymentSubscription] =
    useState<Subscription | null>(null);
  const [exemptionSubscription, setExemptionSubscription] =
    useState<Subscription | null>(null);
  const [exemptionReason, setExemptionReason] = useState("");
  const [savingExemption, setSavingExemption] = useState(false);

  const [subscriptionsOpen, setSubscriptionsOpen] = useState(true);
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [invoiceRefreshKey, setInvoiceRefreshKey] = useState(0);

  const [filterSchoolId, setFilterSchoolId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [subscriptionPage, setSubscriptionPage] = useState(1);
  const [subscriptionTotalPages, setSubscriptionTotalPages] = useState(1);
  const [subscriptionTotal, setSubscriptionTotal] = useState(0);
  const [subscriptionSummary, setSubscriptionSummary] = useState({
    expected_monthly_revenue: 0,
    active_count: 0,
    overdue_count: 0,
  });

  const [loading, setLoading] = useState(true);
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [savingPaymentId, setSavingPaymentId] = useState<number | null>(null);
  const [markingOverdueId, setMarkingOverdueId] = useState<number | null>(null);

  useEffect(() => {
    loadBillingPage();
  }, []);

  async function loadBillingPage() {
    const { profile: currentProfile, error } = await getCurrentProfile();

    if (error || !currentProfile) {
      router.push("/login");
      return;
    }

    if (
      currentProfile.role !== "master" &&
      currentProfile.role !== "principal" &&
      currentProfile.role !== "owner" &&
      !(
        (currentProfile.role === "master_admin" ||
          currentProfile.role === "admin") &&
        Array.isArray(currentProfile.permissions) &&
        currentProfile.permissions.includes(PERMISSIONS.BILLING_MANAGE)
      )
    ) {
      router.push(currentProfile.role === "master_admin" ? "/master-admin" : "/dashboard");
      return;
    }

    setProfile(currentProfile as Profile);

    if (currentProfile.role === "master" || currentProfile.role === "master_admin") {
      setFilterSchoolId(requestedSchoolId);
      setSelectedSchoolId(requestedSchoolId);
      await Promise.all([
        fetchSchools(),
        fetchAllSubscriptions(1, requestedSchoolId, ""),
      ]);
    } else {
      await Promise.all([
        fetchPrincipalSubscription(Number(currentProfile.school_id)),
      ]);
    }

    setLoading(false);
  }

  async function fetchSchools() {
    const { data, error } = await supabase
      .from("schools")
      .select("id, school_name")
      .order("school_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setSchools((data || []) as School[]);
  }

  const fetchAllSubscriptions = useCallback(
    async (
      page = subscriptionPage,
      schoolFilter = filterSchoolId,
      statusFilter = filterStatus
    ) => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: "10",
      });
      if (schoolFilter) params.set("school_id", schoolFilter);
      if (statusFilter) params.set("status", statusFilter);
      const response = await authenticatedFetch(
        `/api/billing/subscriptions?${params.toString()}`
      );
      const result = await response.json();
      if (!response.ok) {
        alert(result.error || "Could not load school subscriptions.");
        return;
      }
      setSubscriptions((result.subscriptions || []) as Subscription[]);
      setSubscriptionPage(Number(result.pagination?.page || 1));
      setSubscriptionTotalPages(Number(result.pagination?.total_pages || 1));
      setSubscriptionTotal(Number(result.pagination?.total || 0));
      setSubscriptionSummary({
        expected_monthly_revenue: Number(
          result.summary?.expected_monthly_revenue || 0
        ),
        active_count: Number(result.summary?.active_count || 0),
        overdue_count: Number(result.summary?.overdue_count || 0),
      });
    },
    [filterSchoolId, filterStatus, subscriptionPage]
  );

  async function fetchPrincipalSubscription(schoolId: number) {
    await fetchAllSubscriptions(1, String(schoolId), "");
  }

  function handlePlanChange(planName: string) {
    setSelectedPlan(planName);
  }

  async function openPaymentPopup(subscription: Subscription) {
    setActivePaymentSubscription(subscription);
    setPaymentAmount(String(subscription.monthly_price));
    setPaymentChargeType("subscription");
    setPaymentMethod("EFT");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentNotes("");

    try {
      const response = await authenticatedFetch(
        `/api/billing/invoices?school_id=${subscription.school_id}`
      );
      const result = await response.json();
      if (!response.ok) return;
      const oldestOpenInvoice = [...(result.invoices || [])]
        .filter((invoice) =>
          ["issued", "partially_paid"].includes(String(invoice.status))
        )
        .sort((left, right) =>
          String(left.issue_date).localeCompare(String(right.issue_date))
        )[0];
      if (oldestOpenInvoice) {
        setPaymentChargeType(
          oldestOpenInvoice.charge_type === "setup_fee"
            ? "setup_fee"
            : "subscription"
        );
        setPaymentAmount(String(oldestOpenInvoice.balance_due || ""));
      }
    } catch {
      // The payment form remains usable with subscription defaults.
    }
  }

  function closePaymentPopup() {
    if (savingPaymentId) return;

    setActivePaymentSubscription(null);
    setPaymentAmount("");
    setPaymentChargeType("subscription");
    setPaymentMethod("EFT");
    setPaymentNotes("");
  }

  async function runPlatformOperation(payload: Record<string, unknown>) {
    const response = await authenticatedFetch("/api/platform-operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not update billing.");
    return result;
  }

  async function saveSubscription() {
    if (!selectedSchoolId) {
      alert("Please select a school.");
      return;
    }

    const plan = PLAN_OPTIONS.find((item) => item.name === selectedPlan);

    if (!plan) {
      alert("Please select a valid plan.");
      return;
    }

    setSavingSubscription(true);

    try {
      await runPlatformOperation({ action: "save_subscription", school_id: Number(selectedSchoolId), plan_name: plan.name, monthly_price: plan.price, status: selectedStatus, next_billing_date: nextBillingDate || null });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not save the subscription.");
      setSavingSubscription(false);
      return;
    }

    setSelectedSchoolId("");
    setSelectedPlan("Bloom");
    setSelectedStatus("trial");
    setNextBillingDate("");

    await fetchAllSubscriptions();
    setSavingSubscription(false);
    setSubscriptionsOpen(true);
    alert("Subscription saved.");
  }

  async function recordPayment(subscription: Subscription) {
    if (savingPaymentId === subscription.id) return;

    const amount = Number(paymentAmount);

    if (!amount || amount <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    setSavingPaymentId(subscription.id);
    const invoiceWindow = window.open("", "_blank");

    let operationResult: {
      payment_date: string;
      next_billing_date: string;
      receipt_number: string;
      invoice_document_url: string | null;
      receipt_email_sent: boolean;
      receipt_email_queued: boolean;
    };
    try {
      operationResult = await runPlatformOperation({
        action: "record_payment",
        school_id: subscription.school_id,
        subscription_id: subscription.id,
        amount,
        charge_type: paymentChargeType,
        plan_name: subscription.plan_name,
        payment_method: paymentMethod || "EFT",
        payment_date: paymentDate,
        notes: paymentNotes || null,
      });
    } catch (error) {
      invoiceWindow?.close();
      alert(error instanceof Error ? error.message : "Could not record the payment.");
      setSavingPaymentId(null);
      return;
    }
    const receiptNumber = operationResult.receipt_number;

    await fetchAllSubscriptions();
    setInvoiceRefreshKey((current) => current + 1);

    setSavingPaymentId(null);
    setActivePaymentSubscription(null);
    setPaymentAmount("");
    setPaymentChargeType("subscription");
    setPaymentMethod("EFT");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentNotes("");
    setSubscriptionsOpen(true);
    setInvoicesOpen(true);

    if (operationResult.invoice_document_url && invoiceWindow) {
      invoiceWindow.location.href = operationResult.invoice_document_url;
    } else if (operationResult.invoice_document_url) {
      window.location.assign(operationResult.invoice_document_url);
    } else {
      invoiceWindow?.close();
      document.getElementById("invoices")?.scrollIntoView({ behavior: "smooth" });
    }

    if (operationResult.receipt_email_sent) {
      alert(`Payment recorded and receipt sent. Receipt number: ${receiptNumber}`);
    } else {
      alert(
        `Payment recorded. Receipt number: ${receiptNumber}. The receipt email is queued and will retry automatically.`
      );
    }
  }

  async function markOverdue(subscription: Subscription) {
    setMarkingOverdueId(subscription.id);

    try {
      await runPlatformOperation({ action: "mark_overdue", school_id: subscription.school_id, subscription_id: subscription.id });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not mark the subscription overdue.");
      setMarkingOverdueId(null);
      return;
    }

    await fetchAllSubscriptions();
    setMarkingOverdueId(null);
    setSubscriptionsOpen(true);
    alert("Subscription marked overdue.");
  }

  async function exemptSetupFee() {
    if (!exemptionSubscription || exemptionReason.trim().length < 3) {
      alert("Enter the reason why this school is exempt from the setup fee.");
      return;
    }

    setSavingExemption(true);
    try {
      const result = await runPlatformOperation({
        action: "exempt_setup_fee",
        school_id: exemptionSubscription.school_id,
        reason: exemptionReason.trim(),
      });
      await fetchAllSubscriptions();
      setInvoiceRefreshKey((current) => current + 1);
      setInvoicesOpen(true);
      setExemptionSubscription(null);
      setExemptionReason("");
      alert(
        "Setup-fee exemption journal passed. It is available in Billing; one receipt email will be sent after payment is recorded."
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "The setup-fee exemption could not be recorded."
      );
    } finally {
      setSavingExemption(false);
    }
  }

  const isMaster = profile?.role === "master" || profile?.role === "master_admin";

  const filteredSubscriptions = subscriptions;

  const expectedMonthlyRevenue = useMemo(() => {
    return subscriptionSummary.expected_monthly_revenue;
  }, [subscriptionSummary.expected_monthly_revenue]);

  const overdueCount = useMemo(() => {
    return subscriptionSummary.overdue_count;
  }, [subscriptionSummary.overdue_count]);

  const activeCount = useMemo(() => {
    return subscriptionSummary.active_count;
  }, [subscriptionSummary.active_count]);

  if (loading) {
    return <p>Loading billing...</p>;
  }

  return (
    <div>
      <div
        className="db-soft-card"
        style={{
          padding: "18px 20px",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              className="db-page-title"
              style={{
                fontSize: "28px",
                marginBottom: "6px",
              }}
            >
              Billing and Payments
            </h1>

            <p className="db-page-subtitle" style={{ marginBottom: 0 }}>
              DailyBloom subscription billing for schools.
            </p>
          </div>

          <button
            type="button"
            className="db-button-primary"
            onClick={() => {
              setInvoicesOpen(true);
              requestAnimationFrame(() =>
                requestAnimationFrame(() =>
                  document
                    .getElementById("invoices")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                )
              );
            }}
          >
            View Invoices & Receipts
          </button>
        </div>
      </div>

      {invoicesOpen ? (
        <section
          id="invoices"
          className="db-soft-card"
          style={{ scrollMarginTop: 24, marginBottom: 18, padding: 18 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 800 }}>Invoices & Receipts</p>
              <p className="db-helper" style={{ margin: "4px 0 0" }}>
                Setup fees, monthly subscriptions, payments and credits.
              </p>
            </div>
            <button
              type="button"
              className="db-button-secondary"
              onClick={() => setInvoicesOpen(false)}
            >
              Close
            </button>
          </div>
          <BillingInvoicesPanel embedded refreshKey={invoiceRefreshKey} />
        </section>
      ) : null}

      {isMaster ? (
        <>
          <div
            className="db-grid-3"
            style={{
              marginBottom: "18px",
            }}
          >
            <CompactStatCard
              title="Expected Monthly Revenue"
              value={`R${expectedMonthlyRevenue.toFixed(2)}`}
            />
            <CompactStatCard
              title="Active Subscriptions"
              value={String(activeCount)}
            />
            <CompactStatCard
              title="Overdue Schools"
              value={String(overdueCount)}
            />
          </div>

          <div
            className="db-card db-card-blue"
            style={{ padding: "18px", marginBottom: "18px" }}
          >
            <h3 style={sectionTitle}>Create or Update Subscription</h3>

            <div style={subscriptionFormGrid}>
              <select
                className="db-input"
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
              >
                <option value="">Select School</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.school_name}
                  </option>
                ))}
              </select>

              <select
                className="db-input"
                value={selectedPlan}
                onChange={(e) => handlePlanChange(e.target.value)}
              >
                {PLAN_OPTIONS.map((plan) => (
                  <option key={plan.name} value={plan.name}>
                    {plan.name} - R{plan.price}
                  </option>
                ))}
              </select>

              <select
                className="db-input"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <input
                className="db-input"
                type="date"
                value={nextBillingDate}
                onChange={(e) => setNextBillingDate(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="db-button-primary"
              style={{ marginTop: "10px", minHeight: "40px" }}
              onClick={saveSubscription}
              disabled={savingSubscription}
            >
              {savingSubscription ? "Saving..." : "Save Subscription"}
            </button>
          </div>
        </>
      ) : null}

      <div
        className="db-card db-card-lavender"
        style={{
          padding: "16px",
          marginBottom: "16px",
        }}
      >
        <button
          type="button"
          onClick={() => setSubscriptionsOpen((prev) => !prev)}
          style={collapseHeaderButton}
        >
          <span>
            {isMaster ? "School Subscriptions" : "Your DailyBloom Subscription"}
          </span>
          <span>{subscriptionsOpen ? "Hide" : "Show"}</span>
        </button>

        {subscriptionsOpen ? (
          <div style={{ marginTop: "14px" }}>
            {isMaster ? (
              <div style={filterGrid}>
                <select
                  className="db-input"
                  value={filterSchoolId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilterSchoolId(value);
                    void fetchAllSubscriptions(1, value, filterStatus);
                  }}
                >
                  <option value="">All schools</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.school_name}
                    </option>
                  ))}
                </select>

                <select
                  className="db-input"
                  value={filterStatus}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilterStatus(value);
                    void fetchAllSubscriptions(1, filterSchoolId, value);
                  }}
                >
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  style={secondaryButton}
                  onClick={() => {
                    setFilterSchoolId("");
                    setFilterStatus("");
                    void fetchAllSubscriptions(1, "", "");
                  }}
                >
                  Clear Filters
                </button>
              </div>
            ) : null}

            {filteredSubscriptions.length === 0 ? (
              <p className="db-helper">
                {isMaster
                  ? "No subscriptions match your filters."
                  : "Your school does not have a subscription record yet."}
              </p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {filteredSubscriptions.map((subscription) => (
                  <div key={subscription.id} className="db-list-card">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "14px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "16px" }}>
                          {subscription.schools?.school_name || "Unnamed school"}
                        </strong>
                        <p style={textStyle}>
                          {subscription.plan_name} · R
                          {Number(subscription.monthly_price).toFixed(2)} ·{" "}
                          {subscription.status}
                        </p>
                        <p style={textStyle}>
                          Next billing:{" "}
                          {subscription.next_billing_date || "Not set"} · Last
                          paid:{" "}
                          {subscription.last_payment_date || "No payment yet"}
                        </p>
                      </div>

                      {isMaster ? (
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                            alignItems: "flex-start",
                          }}
                        >
                          <button
                            type="button"
                            className="db-button-primary"
                            onClick={() => openPaymentPopup(subscription)}
                            disabled={savingPaymentId === subscription.id}
                            style={{ minHeight: "38px" }}
                          >
                            {savingPaymentId === subscription.id
                              ? "Saving..."
                              : "Record Payment"}
                          </button>

                          <button
                            type="button"
                            style={secondaryButton}
                            onClick={() => markOverdue(subscription)}
                            disabled={markingOverdueId === subscription.id}
                          >
                            {markingOverdueId === subscription.id
                              ? "Saving..."
                              : "Mark Overdue"}
                          </button>

                          <button
                            type="button"
                            style={secondaryButton}
                            onClick={() => {
                              setExemptionSubscription(subscription);
                              setExemptionReason("");
                            }}
                          >
                            Exempt Setup Fee
                          </button>

                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {isMaster && subscriptionTotalPages > 1 ? (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      marginTop: 4,
                    }}
                  >
                    <span className="db-helper" style={{ margin: 0 }}>
                      Page {subscriptionPage} of {subscriptionTotalPages} ·{" "}
                      {subscriptionTotal} school subscriptions
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        style={secondaryButton}
                        disabled={subscriptionPage <= 1}
                        onClick={() =>
                          void fetchAllSubscriptions(subscriptionPage - 1)
                        }
                      >
                        Previous 10
                      </button>
                      <button
                        type="button"
                        style={secondaryButton}
                        disabled={subscriptionPage >= subscriptionTotalPages}
                        onClick={() =>
                          void fetchAllSubscriptions(subscriptionPage + 1)
                        }
                      >
                        Next 10
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/*
      <div
        className="db-card db-card-yellow"
        style={{
          padding: "16px",
        }}
      >
        <button
          type="button"
          onClick={() => setPaymentsOpen((prev) => !prev)}
          style={collapseHeaderButton}
        >
          <span>Payment History</span>
          <span>{paymentsOpen ? "Hide" : "Show"}</span>
        </button>

        {paymentsOpen ? (
          <div style={{ marginTop: "14px" }}>
            <div style={filterGrid}>
              {isMaster ? (
                <select
                  className="db-input"
                  value={filterSchoolId}
                  onChange={(e) => setFilterSchoolId(e.target.value)}
                >
                  <option value="">All schools</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.school_name}
                    </option>
                  ))}
                </select>
              ) : null}

              <input
                className="db-input"
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
              />

              <button
                type="button"
                style={secondaryButton}
                onClick={() => {
                  setFilterSchoolId("");
                  setFilterMonth("");
                }}
              >
                Clear Filters
              </button>
            </div>

            {filteredPayments.length === 0 ? (
              <p className="db-helper">No payments match your filters.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {filteredPayments.map((payment) => (
                  <div key={payment.id} className="db-list-card">
                    <strong style={{ fontSize: "16px" }}>
                      {payment.schools?.school_name || "School"}
                    </strong>
                    <p style={textStyle}>
                      R{Number(payment.amount).toFixed(2)} ·{" "}
                      {payment.payment_date} ·{" "}
                      {payment.payment_method || "No method"}
                    </p>
                    <p style={textStyle}>
                      Receipt: {payment.receipt_number || "Not generated"}
                    </p>
                    <p style={textStyle}>Notes: {payment.notes || "None"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
      */}

      {activePaymentSubscription ? (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={modalHeader}>
              <div>
                <h3 style={modalTitle}>Record Payment</h3>
                <p style={modalSubtitle}>
                  {activePaymentSubscription.schools?.school_name ||
                    "Selected school"}
                </p>
              </div>

              <button
                type="button"
                style={closeButton}
                onClick={closePaymentPopup}
                disabled={savingPaymentId === activePaymentSubscription.id}
              >
                ×
              </button>
            </div>

            <div style={{ marginTop: "14px" }}>
              <label style={labelStyle}>Payment Type</label>
              <select
                className="db-input"
                value={paymentChargeType}
                onChange={(e) =>
                  setPaymentChargeType(
                    e.target.value as "setup_fee" | "subscription"
                  )
                }
              >
                <option value="setup_fee">Setup Fee</option>
                <option value="subscription">Subscription Fee</option>
              </select>

              <label style={labelStyle}>Subscription Package</label>
              <input
                className="db-input"
                value={`${activePaymentSubscription.plan_name} Subscription Package`}
                readOnly
              />

              <label style={labelStyle}>Payment Amount</label>
              <input
                className="db-input"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />

              <label style={labelStyle}>Payment Date</label>
              <input
                className="db-input"
                type="date"
                value={paymentDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setPaymentDate(e.target.value)}
              />

              <label style={labelStyle}>Payment Method</label>
              <select
                className="db-input"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="EFT">EFT</option>
                <option value="PayShap">PayShap</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
              </select>

              <label style={labelStyle}>Payment Notes</label>
              <textarea
                className="db-input"
                placeholder="Add notes, reference number, or proof of payment details"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                rows={4}
              />

              <div style={modalActions}>
                <button
                  type="button"
                  style={secondaryButton}
                  onClick={closePaymentPopup}
                  disabled={savingPaymentId === activePaymentSubscription.id}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="db-button-primary"
                  onClick={() => recordPayment(activePaymentSubscription)}
                  disabled={savingPaymentId === activePaymentSubscription.id}
                  style={{ minHeight: "40px" }}
                >
                  {savingPaymentId === activePaymentSubscription.id
                    ? "Recording..."
                    : "Confirm Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {exemptionSubscription ? (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={modalHeader}>
              <div>
                <h3 style={modalTitle}>Setup Fee Exemption</h3>
                <p style={modalSubtitle}>
                  {exemptionSubscription.schools?.school_name ||
                    "Selected school"}
                </p>
              </div>
              <button
                type="button"
                style={closeButton}
                disabled={savingExemption}
                onClick={() => setExemptionSubscription(null)}
              >
                ×
              </button>
            </div>

            <p className="db-helper">
              This passes an auditable journal and changes the setup-fee invoice
              to R0.00 with the exemption reason shown on it.
            </p>
            <label style={labelStyle}>Exemption Reason</label>
            <textarea
              className="db-input"
              rows={4}
              value={exemptionReason}
              placeholder="Example: Promotional setup-fee waiver approved by Master"
              onChange={(event) => setExemptionReason(event.target.value)}
            />
            <div style={modalActions}>
              <button
                type="button"
                style={secondaryButton}
                disabled={savingExemption}
                onClick={() => setExemptionSubscription(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="db-button-primary"
                disabled={savingExemption || exemptionReason.trim().length < 3}
                onClick={exemptSetupFee}
              >
                {savingExemption ? "Saving..." : "Pass Exemption Journal"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CompactStatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="db-card db-card-blue" style={{ padding: "14px 16px" }}>
      <p
        style={{
          margin: 0,
          color: "var(--db-text-soft)",
          fontWeight: 700,
          fontSize: "13px",
        }}
      >
        {title}
      </p>
      <h2
        style={{
          margin: "6px 0 0 0",
          color: "var(--db-text)",
          fontSize: "24px",
          fontWeight: 800,
        }}
      >
        {value}
      </h2>
    </div>
  );
}

const sectionTitle = {
  marginTop: 0,
  marginBottom: "12px",
  color: "var(--db-text)",
  fontSize: "20px",
  fontWeight: 800 as const,
};

const textStyle = {
  margin: "5px 0 0 0",
  color: "var(--db-text-soft)",
};

const collapseHeaderButton = {
  width: "100%",
  border: "none",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "var(--db-text)",
  fontSize: "18px",
  fontWeight: 800,
};

const subscriptionFormGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px",
};

const filterGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px",
  marginBottom: "12px",
};

const secondaryButton = {
  border: "1px solid #E3D9CD",
  background: "#FFFFFF",
  color: "#5B5675",
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(31, 41, 55, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "18px",
  zIndex: 999,
} as const;

const modalCard = {
  width: "100%",
  maxWidth: "480px",
  background: "#FFFFFF",
  borderRadius: "22px",
  padding: "20px",
  boxShadow: "0 20px 60px rgba(31, 41, 55, 0.25)",
} as const;

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
} as const;

const modalTitle = {
  margin: 0,
  color: "var(--db-text)",
  fontSize: "22px",
  fontWeight: 800,
};

const modalSubtitle = {
  margin: "4px 0 0 0",
  color: "var(--db-text-soft)",
  fontSize: "14px",
};

const closeButton = {
  border: "none",
  background: "#F8F4EF",
  color: "#5B5675",
  borderRadius: "999px",
  width: "34px",
  height: "34px",
  cursor: "pointer",
  fontSize: "22px",
  lineHeight: "30px",
};

const labelStyle = {
  display: "block",
  margin: "10px 0 6px 0",
  color: "var(--db-text)",
  fontWeight: 700,
  fontSize: "14px",
};

const modalActions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "14px",
  flexWrap: "wrap",
} as const;
