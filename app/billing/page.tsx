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

  const [loading, setLoading] = useState(true);
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

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
    alert("Subscription saved.");
  }

  async function markPaymentReceived(subscription: Subscription) {
    const amount = Number(paymentAmount);

    if (!amount || amount <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    setSavingPayment(true);

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
      setSavingPayment(false);
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
      setSavingPayment(false);
      return;
    }

    await supabase
      .from("schools")
      .update({ billing_status: "active" })
      .eq("id", subscription.school_id);

    setPaymentNotes("");
    setPaymentMethod("EFT");
    setPaymentAmount(String(subscription.monthly_price));

    await Promise.all([fetchAllSubscriptions(), fetchAllPayments()]);
    setSavingPayment(false);
    alert("Payment recorded.");
  }

  async function markOverdue(subscription: Subscription) {
    const { error } = await supabase
      .from("school_subscriptions")
      .update({
        status: "overdue",
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase
      .from("schools")
      .update({ billing_status: "overdue" })
      .eq("id", subscription.school_id);

    await fetchAllSubscriptions();
    alert("Subscription marked overdue.");
  }

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

  const isMaster = profile?.role === "master";

  if (loading) {
    return <p>Loading billing...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "22px", marginBottom: "24px" }}>
        <h1 className="db-page-title">Billing and Payments</h1>
        <p className="db-page-subtitle">
          DailyBloom subscription billing for schools.
        </p>
      </div>

      {isMaster ? (
        <>
          <div className="db-grid-3" style={{ marginBottom: "24px" }}>
            <StatCard
              title="Expected Monthly Revenue"
              value={`R${expectedMonthlyRevenue.toFixed(2)}`}
            />
            <StatCard title="Active Subscriptions" value={String(activeCount)} />
            <StatCard title="Overdue Schools" value={String(overdueCount)} />
          </div>

          <div className="db-grid-2" style={{ marginBottom: "24px" }}>
            <div className="db-card db-card-blue" style={{ padding: "20px" }}>
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

            <div className="db-card db-card-green" style={{ padding: "20px" }}>
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
                Use the “Mark Paid” button on a school subscription below.
              </p>
            </div>
          </div>
        </>
      ) : null}

      <div className="db-card db-card-lavender" style={{ padding: "20px", marginBottom: "24px" }}>
        <h3 style={sectionTitle}>
          {isMaster ? "School Subscriptions" : "Your DailyBloom Subscription"}
        </h3>

        {subscriptions.length === 0 ? (
          <p className="db-helper">
            {isMaster
              ? "No subscriptions created yet."
              : "Your school does not have a subscription record yet."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {subscriptions.map((subscription) => (
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
                    <strong style={{ fontSize: "17px" }}>
                      {subscription.schools?.school_name || "Unnamed school"}
                    </strong>
                    <p style={textStyle}>Plan: {subscription.plan_name}</p>
                    <p style={textStyle}>
                      Monthly Price: R{Number(subscription.monthly_price).toFixed(2)}
                    </p>
                    <p style={textStyle}>Status: {subscription.status}</p>
                    <p style={textStyle}>
                      Next Billing Date:{" "}
                      {subscription.next_billing_date || "Not set"}
                    </p>
                    <p style={textStyle}>
                      Last Payment Date:{" "}
                      {subscription.last_payment_date || "No payment yet"}
                    </p>
                  </div>

                  {isMaster ? (
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="db-button-primary"
                        onClick={() => markPaymentReceived(subscription)}
                        disabled={savingPayment}
                      >
                        {savingPayment ? "Saving..." : "Mark Paid"}
                      </button>

                      <button
                        type="button"
                        style={secondaryButton}
                        onClick={() => markOverdue(subscription)}
                      >
                        Mark Overdue
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="db-card db-card-yellow" style={{ padding: "20px" }}>
        <h3 style={sectionTitle}>Payment History</h3>

        {payments.length === 0 ? (
          <p className="db-helper">No payments recorded yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {payments.map((payment) => (
              <div key={payment.id} className="db-list-card">
                <strong style={{ fontSize: "17px" }}>
                  {payment.schools?.school_name || "School"}
                </strong>
                <p style={textStyle}>
                  Amount: R{Number(payment.amount).toFixed(2)}
                </p>
                <p style={textStyle}>Date: {payment.payment_date}</p>
                <p style={textStyle}>
                  Method: {payment.payment_method || "Not added"}
                </p>
                <p style={textStyle}>Notes: {payment.notes || "None"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="db-card db-card-blue" style={{ padding: "18px" }}>
      <p style={{ margin: 0, color: "var(--db-text-soft)", fontWeight: 700 }}>
        {title}
      </p>
      <h2
        style={{
          margin: "8px 0 0 0",
          color: "var(--db-text)",
          fontSize: "28px",
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
  marginBottom: "14px",
  color: "var(--db-text)",
  fontSize: "22px",
  fontWeight: 800 as const,
};

const textStyle = {
  margin: "6px 0 0 0",
  color: "var(--db-text-soft)",
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