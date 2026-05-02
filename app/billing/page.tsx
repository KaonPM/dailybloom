"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";

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

type Payment = {
  id: number;
  school_id: number;
  subscription_id: number | null;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  schools?: School | null;
};

type Profile = {
  id: string;
  role: string;
  school_id: number | null;
};

type PrincipalContact = {
  full_name: string | null;
  email: string | null;
};

const PLAN_OPTIONS = [
  { name: "Bloom", price: 299 },
  { name: "Bloom Pro", price: 399 },
  { name: "Bloom Elite", price: 499 },
];

const STATUS_OPTIONS = ["trial", "active", "overdue", "cancelled"];

export default function BillingPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("Bloom");
  const [selectedStatus, setSelectedStatus] = useState("trial");
  const [nextBillingDate, setNextBillingDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("299");
  const [paymentMethod, setPaymentMethod] = useState("EFT");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [subscriptionsOpen, setSubscriptionsOpen] = useState(true);
  const [paymentsOpen, setPaymentsOpen] = useState(false);

  const [filterSchoolId, setFilterSchoolId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

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
      currentProfile.role !== "principal"
    ) {
      router.push("/dashboard");
      return;
    }

    setProfile(currentProfile as Profile);

    if (currentProfile.role === "master") {
      await Promise.all([
        fetchSchools(),
        fetchAllSubscriptions(),
        fetchAllPayments(),
      ]);
    } else {
      await Promise.all([
        fetchPrincipalSubscription(Number(currentProfile.school_id)),
        fetchPrincipalPayments(Number(currentProfile.school_id)),
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

  async function fetchAllSubscriptions() {
    const { data, error } = await supabase
      .from("school_subscriptions")
      .select(
        `
        *,
        schools (
          id,
          school_name
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setSubscriptions((data || []) as Subscription[]);
  }

  async function fetchAllPayments() {
    const { data, error } = await supabase
      .from("subscription_payments")
      .select(
        `
        *,
        schools (
          id,
          school_name
        )
      `
      )
      .order("payment_date", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setPayments((data || []) as Payment[]);
  }

  async function fetchPrincipalSubscription(schoolId: number) {
    const { data, error } = await supabase
      .from("school_subscriptions")
      .select(
        `
        *,
        schools (
          id,
          school_name
        )
      `
      )
      .eq("school_id", schoolId)
      .maybeSingle();

    if (error) {
      alert(error.message);
      return;
    }

    setSubscriptions(data ? ([data] as Subscription[]) : []);
  }

  async function fetchPrincipalPayments(schoolId: number) {
    const { data, error } = await supabase
      .from("subscription_payments")
      .select(
        `
        *,
        schools (
          id,
          school_name
        )
      `
      )
      .eq("school_id", schoolId)
      .order("payment_date", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setPayments((data || []) as Payment[]);
  }

  async function fetchPrincipalContact(
    schoolId: number
  ): Promise<PrincipalContact | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("school_id", schoolId)
      .eq("role", "principal")
      .limit(1);

    if (error) {
      alert(error.message);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0] as PrincipalContact;
  }

  function handlePlanChange(planName: string) {
    setSelectedPlan(planName);

    const plan = PLAN_OPTIONS.find((item) => item.name === planName);

    if (plan) {
      setPaymentAmount(String(plan.price));
    }
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

    const { error } = await supabase.from("school_subscriptions").upsert(
      {
        school_id: Number(selectedSchoolId),
        plan_name: plan.name,
        monthly_price: plan.price,
        status: selectedStatus,
        next_billing_date: nextBillingDate || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "school_id",
      }
    );

    if (error) {
      alert(error.message);
      setSavingSubscription(false);
      return;
    }

    await supabase
      .from("schools")
      .update({ billing_status: selectedStatus })
      .eq("id", Number(selectedSchoolId));

    setSelectedSchoolId("");
    setSelectedPlan("Bloom");
    setSelectedStatus("trial");
    setNextBillingDate("");
    setPaymentAmount("299");

    await fetchAllSubscriptions();
    setSavingSubscription(false);
    setSubscriptionsOpen(true);
    alert("Subscription saved.");
  }

  async function markPaymentReceived(subscription: Subscription) {
    const amount = Number(paymentAmount);

    if (!amount || amount <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    setSavingPaymentId(subscription.id);

    const today = new Date();
    const nextDate = new Date(today);

    nextDate.setMonth(nextDate.getMonth() + 1);

    const paymentDate = today.toISOString().slice(0, 10);
    const nextBilling = nextDate.toISOString().slice(0, 10);

    const { error: paymentError } = await supabase
      .from("subscription_payments")
      .insert([
        {
          school_id: subscription.school_id,
          subscription_id: subscription.id,
          amount,
          payment_date: paymentDate,
          payment_method: paymentMethod || "EFT",
          notes: paymentNotes || null,
        },
      ]);

    if (paymentError) {
      alert(paymentError.message);
      setSavingPaymentId(null);
      return;
    }

    const { error: subscriptionError } = await supabase
      .from("school_subscriptions")
      .update({
        status: "active",
        last_payment_date: paymentDate,
        next_billing_date: nextBilling,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    if (subscriptionError) {
      alert(subscriptionError.message);
      setSavingPaymentId(null);
      return;
    }

    await supabase
      .from("schools")
      .update({ billing_status: "active" })
      .eq("id", subscription.school_id);

    const principalContact = await fetchPrincipalContact(subscription.school_id);

    let emailSent = false;

    if (principalContact?.email) {
      const emailResponse = await fetch("/api/payment-received", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          principalEmail: principalContact.email,
          principalName: principalContact.full_name,
          schoolName: subscription.schools?.school_name || "your school",
          amount,
          paymentDate,
          nextBillingDate: nextBilling,
          paymentMethod: paymentMethod || "EFT",
          paymentNotes: paymentNotes || "",
          planName: subscription.plan_name,
        }),
      });

      emailSent = emailResponse.ok;
    }

    setPaymentNotes("");
    setPaymentMethod("EFT");
    setPaymentAmount(String(subscription.monthly_price));

    await Promise.all([fetchAllSubscriptions(), fetchAllPayments()]);

    setSavingPaymentId(null);
    setSubscriptionsOpen(true);
    setPaymentsOpen(true);

    if (emailSent) {
      alert("Payment recorded and confirmation email sent.");
    } else {
      alert(
        "Payment recorded, but no confirmation email was sent. Please check that the principal profile has an email address."
      );
    }
  }

  async function markOverdue(subscription: Subscription) {
    setMarkingOverdueId(subscription.id);

    const { error } = await supabase
      .from("school_subscriptions")
      .update({
        status: "overdue",
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    if (error) {
      alert(error.message);
      setMarkingOverdueId(null);
      return;
    }

    await supabase
      .from("schools")
      .update({ billing_status: "overdue" })
      .eq("id", subscription.school_id);

    await fetchAllSubscriptions();
    setMarkingOverdueId(null);
    setSubscriptionsOpen(true);
    alert("Subscription marked overdue.");
  }

  const isMaster = profile?.role === "master";

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((subscription) => {
      const schoolMatches =
        !filterSchoolId ||
        Number(filterSchoolId) === Number(subscription.school_id);

      const statusMatches = !filterStatus || subscription.status === filterStatus;

      return schoolMatches && statusMatches;
    });
  }, [subscriptions, filterSchoolId, filterStatus]);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const schoolMatches =
        !filterSchoolId || Number(filterSchoolId) === Number(payment.school_id);

      const monthMatches =
        !filterMonth || payment.payment_date?.slice(0, 7) === filterMonth;

      return schoolMatches && monthMatches;
    });
  }, [payments, filterSchoolId, filterMonth]);

  const expectedMonthlyRevenue = useMemo(() => {
    return subscriptions
      .filter((item) => item.status === "active" || item.status === "trial")
      .reduce((sum, item) => sum + Number(item.monthly_price || 0), 0);
  }, [subscriptions]);

  const overdueCount = useMemo(() => {
    return subscriptions.filter((item) => item.status === "overdue").length;
  }, [subscriptions]);

  const activeCount = useMemo(() => {
    return subscriptions.filter((item) => item.status === "active").length;
  }, [subscriptions]);

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
            className="db-grid-2"
            style={{
              marginBottom: "18px",
            }}
          >
            <div className="db-card db-card-blue" style={{ padding: "18px" }}>
              <h3 style={sectionTitle}>Create or Update Subscription</h3>

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

              <button
                type="button"
                className="db-button-primary"
                style={{ width: "100%" }}
                onClick={saveSubscription}
                disabled={savingSubscription}
              >
                {savingSubscription ? "Saving..." : "Save Subscription"}
              </button>
            </div>

            <div className="db-card db-card-green" style={{ padding: "18px" }}>
              <h3 style={sectionTitle}>Payment Details</h3>

              <input
                className="db-input"
                type="number"
                placeholder="Payment Amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />

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

              <textarea
                className="db-input"
                placeholder="Payment notes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                rows={4}
              />

              <p className="db-helper">
                Use the Mark Paid button on a school subscription below.
              </p>
            </div>
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
                  onChange={(e) => setFilterSchoolId(e.target.value)}
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
                  onChange={(e) => setFilterStatus(e.target.value)}
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
                          paid: {subscription.last_payment_date || "No payment yet"}
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
                            onClick={() => markPaymentReceived(subscription)}
                            disabled={savingPaymentId === subscription.id}
                            style={{ minHeight: "38px" }}
                          >
                            {savingPaymentId === subscription.id
                              ? "Saving..."
                              : "Mark Paid"}
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
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

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

                    <p style={textStyle}>Notes: {payment.notes || "None"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
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