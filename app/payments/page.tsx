"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveSchoolContext } from "../lib/school-context";

type PaymentItem = {
  id: number;
  learner_name?: string | null;
  amount?: number | null;
  payment_date?: string | null;
  status?: string | null;
  school_id?: number | null;
  created_at?: string | null;
  payment_month?: number | null;
  payment_year?: number | null;
  parent_phone?: string | null;
};

type LearnerItem = {
  id: string;
  name?: string | null;
  parent_phone?: string | null;
  school_id?: number | null;
};

type SchoolItem = {
  id: number;
  school_name?: string | null;
};

export default function PaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const today = new Date();
  const todayDate = today.toISOString().split("T")[0];

  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [learners, setLearners] = useState<LearnerItem[]>([]);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [school, setSchool] = useState<SchoolItem | null>(null);

  const [learnerName, setLearnerName] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayDate);
  const [scheduledReminderDate, setScheduledReminderDate] = useState(todayDate);
  const [status, setStatus] = useState("paid");
  const [paymentMonth, setPaymentMonth] = useState(String(today.getMonth() + 1));
  const [paymentYear, setPaymentYear] = useState(String(today.getFullYear()));
  const [parentPhone, setParentPhone] = useState("");

  const [selectedReminderMonth, setSelectedReminderMonth] = useState(
    String(today.getMonth() + 1)
  );
  const [selectedReminderYear, setSelectedReminderYear] = useState(
    String(today.getFullYear())
  );

  const [historyFromDate, setHistoryFromDate] = useState(todayDate);
  const [historyToDate, setHistoryToDate] = useState(todayDate);

  const [showRecordForm, setShowRecordForm] = useState(false);
  const [showUnpaidLearners, setShowUnpaidLearners] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);

  const [highlightRecordForm, setHighlightRecordForm] = useState(false);
  const [lastSavedSuccess, setLastSavedSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const formRef = useRef<HTMLDivElement | null>(null);
  const learnerInputRef = useRef<HTMLInputElement | null>(null);

  const action = searchParams.get("action");
  const schoolParam = searchParams.get("school");
  const returnTo = searchParams.get("returnTo");

  const shouldShowBackToOverview =
    returnTo === "school-overview" && schoolId !== null;
  const shouldShowBackToDashboard = returnTo === "dashboard";

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (action === "record") {
      setShowRecordForm(true);
      setHighlightRecordForm(true);

      const timer = window.setTimeout(() => {
        formRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        window.setTimeout(() => {
          learnerInputRef.current?.focus();

          const params = new URLSearchParams(searchParams.toString());
          params.delete("action");

          const nextQuery = params.toString();
          router.replace(nextQuery ? `/payments?${nextQuery}` : "/payments", {
            scroll: false,
          });
        }, 350);
      }, 250);

      return () => window.clearTimeout(timer);
    }
  }, [action, router, searchParams]);

  useEffect(() => {
    if (!highlightRecordForm) return;

    const timer = window.setTimeout(() => {
      setHighlightRecordForm(false);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [highlightRecordForm]);

  async function loadPage() {
    const context = await resolveSchoolContext(schoolParam);

    if (context.error) {
      router.push("/login");
      return;
    }

    if (context.shouldReturnToMaster || !context.schoolId) {
      router.push("/master");
      return;
    }

    setSchoolId(context.schoolId);

    await Promise.all([
      fetchSchool(context.schoolId),
      fetchPayments(context.schoolId),
      fetchLearners(context.schoolId),
    ]);
  }

  async function fetchSchool(currentSchoolId: number) {
    const { data } = await supabase
      .from("schools")
      .select("id, school_name")
      .eq("id", currentSchoolId)
      .single();

    setSchool((data || null) as SchoolItem | null);
  }

  async function fetchPayments(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("payment_date", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setPayments((data || []) as PaymentItem[]);
  }

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("id, name, parent_phone, school_id")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as LearnerItem[]);
  }

  function handleLearnerSelection(value: string) {
    setLearnerName(value);

    const learner = learners.find(
      (item) =>
        String(item.name || "").trim().toLowerCase() ===
        value.trim().toLowerCase()
    );

    setParentPhone(learner?.parent_phone || "");
  }

  async function recordPayment() {
    if (!learnerName.trim() || !amount || !paymentDate || !schoolId) {
      alert("Please complete learner name, amount, and payment date.");
      return;
    }

    const parsedAmount = Number(amount);
    const parsedMonth = Number(paymentMonth);
    const parsedYear = Number(paymentYear);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (
      Number.isNaN(parsedMonth) ||
      parsedMonth < 1 ||
      parsedMonth > 12 ||
      Number.isNaN(parsedYear)
    ) {
      alert("Please enter a valid payment month and year.");
      return;
    }

    setLoading(true);
    setLastSavedSuccess(false);

    const { error } = await supabase.from("payments").insert([
      {
        learner_name: learnerName.trim(),
        amount: parsedAmount,
        payment_date: paymentDate,
        status,
        school_id: Number(schoolId),
        payment_month: parsedMonth,
        payment_year: parsedYear,
        parent_phone: parentPhone.trim() || null,
      },
    ]);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setLearnerName("");
    setAmount("");
    setPaymentDate(todayDate);
    setStatus("paid");
    setPaymentMonth(String(today.getMonth() + 1));
    setPaymentYear(String(today.getFullYear()));
    setParentPhone("");

    await fetchPayments(Number(schoolId));

    setLoading(false);
    setLastSavedSuccess(true);
    setShowRecordForm(false);
  }

  const paidLearnersForSelectedMonth = useMemo(() => {
    const month = Number(selectedReminderMonth);
    const year = Number(selectedReminderYear);

    return new Set(
      payments
        .filter(
          (payment) =>
            Number(payment.payment_month) === month &&
            Number(payment.payment_year) === year &&
            String(payment.status || "").toLowerCase() === "paid"
        )
        .map((payment) => String(payment.learner_name || "").trim().toLowerCase())
        .filter(Boolean)
    );
  }, [payments, selectedReminderMonth, selectedReminderYear]);

  const paidLearners = useMemo(() => {
    return learners.filter((learner) => {
      const learnerKey = String(learner.name || "").trim().toLowerCase();
      return learnerKey && paidLearnersForSelectedMonth.has(learnerKey);
    });
  }, [learners, paidLearnersForSelectedMonth]);

  const unpaidLearners = useMemo(() => {
    return learners.filter((learner) => {
      const learnerKey = String(learner.name || "").trim().toLowerCase();
      return learnerKey && !paidLearnersForSelectedMonth.has(learnerKey);
    });
  }, [learners, paidLearnersForSelectedMonth]);

  const unpaidLearnersWithPhones = useMemo(() => {
    return unpaidLearners.filter((learner) =>
      Boolean(String(learner.parent_phone || "").trim())
    );
  }, [unpaidLearners]);

  const filteredPaymentHistory = useMemo(() => {
    return payments.filter((payment) => {
      const date = payment.payment_date || "";
      return date >= historyFromDate && date <= historyToDate;
    });
  }, [payments, historyFromDate, historyToDate]);

  async function scheduleReminderMessages() {
    if (!schoolId) return;

    if (unpaidLearners.length === 0) {
      alert("No unpaid learners found for the selected month.");
      return;
    }

    if (unpaidLearnersWithPhones.length === 0) {
      alert("No unpaid learners have parent phone numbers saved.");
      return;
    }

    const confirmSchedule = window.confirm(
      `Schedule ${unpaidLearnersWithPhones.length} SMS reminder message(s) for ${scheduledReminderDate}?`
    );

    if (!confirmSchedule) return;

    setScheduling(true);

    const { data: reminderCampaign, error: reminderError } = await supabase
      .from("payment_reminders")
      .insert([
        {
          school_id: Number(schoolId),
          scheduled_date: scheduledReminderDate,
          status: "scheduled",
        },
      ])
      .select()
      .single();

    if (reminderError || !reminderCampaign) {
      alert(
        "Could not create reminder campaign. " +
          (reminderError?.message || "")
      );
      setScheduling(false);
      return;
    }

    const reminderRows = unpaidLearnersWithPhones.map((learner) => ({
      reminder_id: reminderCampaign.id,
      school_id: Number(schoolId),
      learner_id: learner.id,
      parent_phone: learner.parent_phone || "",
      message: buildPaymentReminderMessage(learner),
      status: "pending",
      retry_count: 0,
    }));

    const { error: logError } = await supabase
      .from("message_logs")
      .insert(reminderRows);

    if (logError) {
      await supabase
        .from("payment_reminders")
        .update({ status: "failed" })
        .eq("id", reminderCampaign.id);

      alert("Could not create reminder messages. " + logError.message);
      setScheduling(false);
      return;
    }

    setScheduling(false);
    alert(`${reminderRows.length} SMS reminder message(s) scheduled.`);
  }

  function buildPaymentReminderMessage(learner: LearnerItem) {
    const schoolName = school?.school_name || "DailyBloom School";
    const monthName = new Date(
      Number(selectedReminderYear),
      Number(selectedReminderMonth) - 1,
      1
    ).toLocaleString("en-US", { month: "long" });

    return `Dear Parent, ${schoolName} reminds you that fees for ${
      learner.name || "your child"
    } for ${monthName} ${selectedReminderYear} are still outstanding. Please ignore if already paid.`;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 className="db-page-title">Payments</h2>
            <p className="db-page-subtitle">
              Record payments and schedule SMS reminders for unpaid learners.
            </p>
          </div>

          <button
            type="button"
            className="db-button-primary"
            onClick={() => setShowRecordForm((prev) => !prev)}
          >
            {showRecordForm ? "Close" : "Record Payment"}
          </button>
        </div>
      </div>

      <div className="db-card db-card-yellow" style={{ padding: 16, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div>
            <h3 style={sectionTitle}>Payment Month</h3>
            <p style={smallText}>Choose the month used for paid and unpaid counts.</p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              className="db-input"
              value={selectedReminderMonth}
              onChange={(e) => setSelectedReminderMonth(e.target.value)}
              style={{ marginBottom: 0, minWidth: 140 }}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>
                  Month {month}
                </option>
              ))}
            </select>

            <input
              className="db-input"
              type="number"
              placeholder="Year"
              value={selectedReminderYear}
              onChange={(e) => setSelectedReminderYear(e.target.value)}
              style={{ marginBottom: 0, width: 120 }}
            />
          </div>
        </div>

        <div style={statsGrid}>
          <InsightCard
            label="Paid Learners"
            value={paidLearners.length}
            helper="Marked paid for selected month"
            background="#EEF9EE"
            border="#D3EDD4"
          />

          <InsightCard
            label="Unpaid Learners"
            value={unpaidLearners.length}
            helper="Need payment follow-up"
            background="#F8E8F0"
            border="#EBC9D8"
          />
        </div>
      </div>

      <div
        ref={formRef}
        className="db-card db-card-green"
        style={{
          padding: 16,
          marginBottom: 18,
          display: showRecordForm ? "block" : "none",
          border: highlightRecordForm ? "2px solid #7CCCF3" : "1px solid rgba(0,0,0,0.06)",
          boxShadow: highlightRecordForm
            ? "0 0 0 4px rgba(124, 204, 243, 0.18)"
            : undefined,
          transition: "all 0.2s ease",
        }}
      >
        <h3 style={sectionTitle}>Record Payment</h3>

        {lastSavedSuccess ? (
          <div style={successBox}>
            <p style={{ margin: 0, color: "#2D2A3E", fontSize: 14, fontWeight: 700 }}>
              Payment recorded successfully.
            </p>

            {shouldShowBackToOverview ? (
              <button
                type="button"
                className="db-button-primary"
                style={{ marginTop: 10 }}
                onClick={() => router.push(`/master/school/${schoolId}`)}
              >
                Back to School Overview
              </button>
            ) : null}

            {shouldShowBackToDashboard ? (
              <button
                type="button"
                className="db-button-primary"
                style={{ marginTop: 10 }}
                onClick={() => router.push("/dashboard")}
              >
                Back to Dashboard
              </button>
            ) : null}
          </div>
        ) : null}

        <div style={formGrid}>
          <div>
            <p style={labelText}>Learner Name</p>
            <input
              ref={learnerInputRef}
              className="db-input"
              placeholder="Learner name"
              value={learnerName}
              onChange={(e) => handleLearnerSelection(e.target.value)}
              list="learner-options"
            />

            <datalist id="learner-options">
              {learners.map((learner) => (
                <option key={learner.id} value={learner.name || ""} />
              ))}
            </datalist>
          </div>

          <div>
            <p style={labelText}>Parent Phone Number</p>
            <input
              className="db-input"
              placeholder="Parent phone number"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
            />
          </div>

          <div>
            <p style={labelText}>Amount</p>
            <input
              className="db-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <p style={labelText}>Payment Date</p>
            <input
              className="db-input"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <div>
            <p style={labelText}>Month</p>
            <select
              className="db-input"
              value={paymentMonth}
              onChange={(e) => setPaymentMonth(e.target.value)}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>
                  Month {month}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p style={labelText}>Year</p>
            <input
              className="db-input"
              type="number"
              placeholder="Payment year"
              value={paymentYear}
              onChange={(e) => setPaymentYear(e.target.value)}
            />
          </div>

          <div>
            <p style={labelText}>Status</p>
            <select
              className="db-input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        <button
          className="db-button-primary"
          style={{ width: "100%", marginTop: 10 }}
          onClick={recordPayment}
          disabled={loading}
        >
          {loading ? "Saving..." : "Record Payment"}
        </button>
      </div>

      <div className="db-card db-card-yellow" style={{ padding: 16, marginBottom: 18 }}>
        <div style={sectionHeader}>
          <div>
            <h3 style={sectionTitle}>Monthly Payment Reminders</h3>
            <p style={smallText}>
              Schedule SMS reminders to parents of unpaid learners for the selected month.
            </p>
          </div>

          <div style={{ marginTop: 12, marginBottom: 12 }}>
            <p style={labelText}>Reminder Send Date</p>

            <input
              className="db-input"
              type="date"
              value={scheduledReminderDate}
              min={todayDate}
              onChange={(e) => setScheduledReminderDate(e.target.value)}
              style={{ maxWidth: 240 }}
            />
          </div>

          <button
            type="button"
            className="db-button-secondary"
            onClick={() => setShowUnpaidLearners((prev) => !prev)}
          >
            {showUnpaidLearners ? "Hide" : `View Unpaid (${unpaidLearners.length})`}
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button
            className="db-button-primary"
            onClick={scheduleReminderMessages}
            disabled={scheduling}
          >
            {scheduling
              ? "Scheduling..."
              : `Schedule Reminder Messages (${unpaidLearnersWithPhones.length})`}
          </button>
        </div>

        {showUnpaidLearners ? (
          <div style={{ marginTop: 14 }}>
            {unpaidLearners.length === 0 ? (
              <p className="db-helper">Everyone appears paid for the selected month.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {unpaidLearners.map((learner) => (
                  <div key={learner.id} style={compactCard}>
                    <div>
                      <strong>{learner.name || "Unnamed learner"}</strong>
                      <p style={smallText}>
                        Parent Phone: {learner.parent_phone || "Not added"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="db-card db-card-lavender" style={{ padding: 16 }}>
        <div style={sectionHeader}>
          <div>
            <h3 style={sectionTitle}>Payment History ({filteredPaymentHistory.length})</h3>
            <p style={smallText}>Open only when you need to review payment records.</p>
          </div>

          <button
            type="button"
            className="db-button-secondary"
            onClick={() => setShowPaymentHistory((prev) => !prev)}
          >
            {showPaymentHistory ? "Hide" : "View History"}
          </button>
        </div>

        {showPaymentHistory ? (
          <div style={{ marginTop: 14 }}>
            <div style={formGrid}>
              <div>
                <p style={labelText}>From</p>
                <input
                  className="db-input"
                  type="date"
                  value={historyFromDate}
                  onChange={(e) => setHistoryFromDate(e.target.value)}
                />
              </div>

              <div>
                <p style={labelText}>To</p>
                <input
                  className="db-input"
                  type="date"
                  value={historyToDate}
                  onChange={(e) => setHistoryToDate(e.target.value)}
                />
              </div>
            </div>

            {filteredPaymentHistory.length === 0 ? (
              <p className="db-helper">No payments found for this period.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {filteredPaymentHistory.map((payment) => (
                  <div key={payment.id} style={historyRow}>
                    <div>
                      <strong>{payment.learner_name || "Unnamed learner"}</strong>
                      <p style={smallText}>
                        {payment.payment_date || "No date"} | Month{" "}
                        {payment.payment_month || "-"} / {payment.payment_year || "-"}
                      </p>
                    </div>

                    <span style={pillBlue}>
                      {payment.amount !== null && payment.amount !== undefined
                        ? `R${Number(payment.amount).toFixed(2)}`
                        : "No amount"}
                    </span>

                    <span style={pillNeutral}>{payment.status || "Not set"}</span>
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

function InsightCard({
  label,
  value,
  helper,
  background,
  border,
}: {
  label: string;
  value: string | number;
  helper: string;
  background: string;
  border: string;
}) {
  return (
    <div
      style={{
        background,
        border: `1px solid ${border}`,
        borderRadius: 18,
        padding: 16,
        boxShadow: "0 8px 18px rgba(45, 42, 62, 0.05)",
      }}
    >
      <p style={{ margin: 0, color: "#5B5675", fontSize: 14, fontWeight: 700 }}>
        {label}
      </p>

      <h2
        style={{
          margin: "8px 0 0 0",
          color: "#2D2A3E",
          fontSize: 30,
          fontWeight: 800,
        }}
      >
        {value}
      </h2>

      <p style={smallText}>{helper}</p>
    </div>
  );
}

const sectionTitle = {
  margin: 0,
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 800 as const,
};

const labelText = {
  margin: "0 0 8px 0",
  color: "#6D6888",
  fontSize: 13,
  fontWeight: 800,
};

const smallText = {
  margin: "6px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
  lineHeight: 1.5,
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 10,
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap" as const,
};

const successBox = {
  background: "#EEF9EE",
  border: "1px solid #D3EDD4",
  borderRadius: 14,
  padding: "12px 14px",
  marginBottom: 14,
};

const compactCard = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  color: "#2D2A3E",
};

const historyRow = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
  display: "grid",
  gridTemplateColumns: "1fr 120px 110px",
  gap: 8,
  alignItems: "center",
  color: "#2D2A3E",
};

const pillBlue = {
  background: "#EAF7FD",
  border: "1px solid #CBEAF7",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  textAlign: "center" as const,
};

const pillNeutral = {
  background: "#F8F4FF",
  border: "1px solid #E7DFF8",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  textAlign: "center" as const,
};