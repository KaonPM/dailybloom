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
  id: number;
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

  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [learners, setLearners] = useState<LearnerItem[]>([]);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [school, setSchool] = useState<SchoolItem | null>(null);

  const [learnerName, setLearnerName] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [status, setStatus] = useState("paid");
  const [paymentMonth, setPaymentMonth] = useState(String(today.getMonth() + 1));
  const [paymentYear, setPaymentYear] = useState(String(today.getFullYear()));
  const [parentPhone, setParentPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedReminderMonth, setSelectedReminderMonth] = useState(String(today.getMonth() + 1));
  const [selectedReminderYear, setSelectedReminderYear] = useState(String(today.getFullYear()));

  const [showRecordForm, setShowRecordForm] = useState(true);
  const [highlightRecordForm, setHighlightRecordForm] = useState(false);
  const [lastSavedSuccess, setLastSavedSuccess] = useState(false);

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
          router.replace(nextQuery ? `/payments?${nextQuery}` : "/payments", { scroll: false });
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

  async function recordPayment() {
    if (!learnerName.trim() || !amount || !paymentDate || !schoolId) {
      alert("Please complete learner name, amount, and payment date");
      return;
    }

    const parsedAmount = Number(amount);
    const parsedMonth = Number(paymentMonth);
    const parsedYear = Number(paymentYear);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (
      Number.isNaN(parsedMonth) ||
      parsedMonth < 1 ||
      parsedMonth > 12 ||
      Number.isNaN(parsedYear)
    ) {
      alert("Please enter a valid payment month and year");
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
    setPaymentDate("");
    setStatus("paid");
    setPaymentMonth(String(today.getMonth() + 1));
    setPaymentYear(String(today.getFullYear()));
    setParentPhone("");

    await fetchPayments(Number(schoolId));
    setLoading(false);
    setLastSavedSuccess(true);
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

  const unpaidLearners = useMemo(() => {
    return learners.filter((learner) => {
      const learnerKey = String(learner.name || "").trim().toLowerCase();
      return learnerKey && !paidLearnersForSelectedMonth.has(learnerKey);
    });
  }, [learners, paidLearnersForSelectedMonth]);

  async function sendMonthlyReminders() {
    if (unpaidLearners.length === 0) {
      alert("No unpaid learners found for the selected month.");
      return;
    }

    const reminderRows = unpaidLearners.map((learner) => ({
      school_id: Number(schoolId),
      learner_name: learner.name || "",
      parent_phone: learner.parent_phone || null,
      payment_month: Number(selectedReminderMonth),
      payment_year: Number(selectedReminderYear),
      status: "pending",
      message: `Monthly payment reminder for ${learner.name || "learner"}`,
    }));

    const { error } = await supabase.from("payment_reminders").insert(reminderRows);

    if (error) {
      alert(
        "Could not save monthly reminders. Make sure payment_reminders table exists. " +
          error.message
      );
      return;
    }

    alert("Monthly reminders prepared for unpaid learners.");
  }

  function sanitizePhone(phone?: string | null) {
    if (!phone) return "";
    return phone.replace(/[^\d]/g, "");
  }

  function buildPaymentReminderMessage(learner: LearnerItem) {
    const schoolName = school?.school_name || "DailyBloom School";
    const monthName = new Date(
      Number(selectedReminderYear),
      Number(selectedReminderMonth) - 1,
      1
    ).toLocaleString("en-US", { month: "long" });

    return `Hello Parent,

This is a friendly payment reminder from ${schoolName}.

Our records show that ${learner.name || "your child"} does not yet have a paid fee recorded for ${monthName} ${selectedReminderYear}.

Please make payment at your earliest convenience. Kindly ignore if payment has already been made.

Thank you.`;
  }
async function logCommunication(params: {
  learnerName?: string | null;
  parentPhone?: string | null;
  communicationType: string;
  messagePreview: string;
}) {
  if (!schoolId) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  await supabase.from("communication_logs").insert([
    {
      school_id: Number(schoolId),
      learner_name: params.learnerName || null,
      parent_phone: params.parentPhone || null,
      communication_type: params.communicationType,
      channel: "whatsapp",
      message_preview: params.messagePreview.slice(0, 250),
      sent_by_user_id: session?.user?.id || null,
      status: "sent",
    },
  ]);
}
  async function sendPaymentReminderWhatsApp(learner: LearnerItem) {
  const phone = sanitizePhone(learner.parent_phone);

  if (!phone) {
    alert("This learner does not have a parent phone number yet.");
    return;
  }

  const rawMessage = buildPaymentReminderMessage(learner);

  await logCommunication({
    learnerName: learner.name || null,
    parentPhone: learner.parent_phone || null,
    communicationType: "payment_reminder",
    messagePreview: rawMessage,
  });

  const message = encodeURIComponent(rawMessage);
  const whatsappUrl = `https://wa.me/${phone}?text=${message}`;
  window.open(whatsappUrl, "_blank");
}

  function sendAllWhatsAppReminders() {
    if (unpaidLearners.length === 0) {
      alert("No unpaid learners found for the selected month.");
      return;
    }

    const learnersWithPhones = unpaidLearners.filter((learner) =>
      Boolean(sanitizePhone(learner.parent_phone))
    );

    if (learnersWithPhones.length === 0) {
      alert("No unpaid learners have parent phone numbers saved.");
      return;
    }

    learnersWithPhones.forEach((learner, index) => {
      const delay = index * 500;
      window.setTimeout(() => {
        sendPaymentReminderWhatsApp(learner);
      }, delay);
    });
  }

  const selectedMonthPaidPayments = useMemo(() => {
    const month = Number(selectedReminderMonth);
    const year = Number(selectedReminderYear);

    return payments.filter(
      (payment) =>
        Number(payment.payment_month) === month &&
        Number(payment.payment_year) === year &&
        String(payment.status || "").toLowerCase() === "paid"
    );
  }, [payments, selectedReminderMonth, selectedReminderYear]);

  const selectedMonthPendingPayments = useMemo(() => {
    const month = Number(selectedReminderMonth);
    const year = Number(selectedReminderYear);

    return payments.filter(
      (payment) =>
        Number(payment.payment_month) === month &&
        Number(payment.payment_year) === year &&
        String(payment.status || "").toLowerCase() !== "paid"
    );
  }, [payments, selectedReminderMonth, selectedReminderYear]);

  const paidLearnersCount = paidLearnersForSelectedMonth.size;
  const unpaidLearnersCount = unpaidLearners.length;
  const totalLearnersCount = learners.length;

  const collectionRate = totalLearnersCount
    ? Math.round((paidLearnersCount / totalLearnersCount) * 100)
    : 0;

  const totalCollectedAmount = selectedMonthPaidPayments.reduce((sum, payment) => {
    return sum + Number(payment.amount || 0);
  }, 0);

  const averageCollectedPerPaidLearner = paidLearnersCount
    ? totalCollectedAmount / paidLearnersCount
    : 0;

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "20px 22px", marginBottom: "24px" }}>
        <h2 className="db-page-title">Payments</h2>
        <p className="db-page-subtitle">
          Record payments, track monthly collection performance, and send WhatsApp-ready reminders for unpaid learners.
        </p>
      </div>

      <div className="db-card db-card-yellow" style={{ padding: "20px", marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "14px",
          }}
        >
          <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Payment Intelligence</h3>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <select
              className="db-input"
              value={selectedReminderMonth}
              onChange={(e) => setSelectedReminderMonth(e.target.value)}
              style={{ marginBottom: 0, minWidth: "140px" }}
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
              style={{ marginBottom: 0, width: "120px" }}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          <InsightCard
            label="Paid Learners"
            value={paidLearnersCount}
            helper="Marked paid this month"
            background="#EEF9EE"
            border="#D3EDD4"
          />
          <InsightCard
            label="Unpaid Learners"
            value={unpaidLearnersCount}
            helper="Still needing payment"
            background="#F8E8F0"
            border="#EBC9D8"
          />
          <InsightCard
            label="Collection Rate"
            value={`${collectionRate}%`}
            helper="Paid learners out of total learners"
            background="#EAF7FD"
            border="#CBEAF7"
          />
          <InsightCard
            label="Collected Amount"
            value={`R${totalCollectedAmount.toFixed(2)}`}
            helper="Total recorded as paid"
            background="#FFF7D9"
            border="#F3E4A3"
          />
          <InsightCard
            label="Average Paid Value"
            value={`R${averageCollectedPerPaidLearner.toFixed(2)}`}
            helper="Average amount per paid learner"
            background="#EAF7FD"
            border="#CBEAF7"
          />
          <InsightCard
            label="Pending / Non-Paid Records"
            value={selectedMonthPendingPayments.length}
            helper="Pending, partial, or overdue"
            background="#FFF7D9"
            border="#F3E4A3"
          />
        </div>
      </div>

      <div
        ref={formRef}
        className="db-card db-card-green"
        style={{
          padding: "20px",
          marginBottom: "24px",
          border: highlightRecordForm ? "2px solid #7CCCF3" : "1px solid rgba(0,0,0,0.06)",
          boxShadow: highlightRecordForm
            ? "0 0 0 4px rgba(124, 204, 243, 0.18)"
            : undefined,
          transition: "all 0.2s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "14px",
          }}
        >
          <h3 style={sectionTitle}>Record Payment</h3>

          <button
            type="button"
            className="db-button-secondary"
            style={{ minHeight: "38px", padding: "8px 12px" }}
            onClick={() => setShowRecordForm((prev) => !prev)}
          >
            {showRecordForm ? "Hide Form" : "Show Form"}
          </button>
        </div>

        {lastSavedSuccess && (
          <div
            style={{
              background: "#EEF9EE",
              border: "1px solid #D3EDD4",
              borderRadius: "14px",
              padding: "12px 14px",
              marginBottom: "14px",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#2D2A3E",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              Payment recorded successfully.
            </p>

            {shouldShowBackToOverview && (
              <button
                type="button"
                className="db-button-primary"
                style={{ marginTop: "10px" }}
                onClick={() => router.push(`/master/school/${schoolId}`)}
              >
                Back to School Overview
              </button>
            )}

            {shouldShowBackToDashboard && (
              <button
                type="button"
                className="db-button-primary"
                style={{ marginTop: "10px" }}
                onClick={() => router.push("/dashboard")}
              >
                Back to Dashboard
              </button>
            )}
          </div>
        )}

        {showRecordForm ? (
          <>
            <input
              ref={learnerInputRef}
              className="db-input"
              placeholder="Learner Name"
              value={learnerName}
              onChange={(e) => setLearnerName(e.target.value)}
            />

            <input
              className="db-input"
              placeholder="Parent Phone Number"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
            />

            <input
              className="db-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <input
              className="db-input"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />

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

            <input
              className="db-input"
              type="number"
              placeholder="Payment Year"
              value={paymentYear}
              onChange={(e) => setPaymentYear(e.target.value)}
            />

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

            <button
              className="db-button-primary"
              style={{ width: "100%" }}
              onClick={recordPayment}
              disabled={loading}
            >
              {loading ? "Saving..." : "Record Payment"}
            </button>
          </>
        ) : (
          <p className="db-helper">The record payment form is hidden.</p>
        )}
      </div>

      <div className="db-card db-card-yellow" style={{ padding: "20px", marginBottom: "24px" }}>
        <h3 style={sectionTitle}>Monthly Payment Reminders</h3>
        <p className="db-helper" style={{ marginBottom: "14px" }}>
          The selected month determines which learners are treated as unpaid and ready for follow-up.
        </p>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "14px",
          }}
        >
          <button
            className="db-button-secondary"
            onClick={sendMonthlyReminders}
          >
            Save Reminder Records
          </button>

          <button
            className="db-button-primary"
            onClick={sendAllWhatsAppReminders}
          >
            Send All via WhatsApp
          </button>
        </div>

        <div
          style={{
            background: "#FFFDFB",
            border: "1px solid #F0E3D8",
            borderRadius: "16px",
            padding: "14px",
            marginBottom: "14px",
          }}
        >
          <strong style={{ fontSize: "16px", color: "#2D2A3E" }}>
            Unpaid Learners ({unpaidLearners.length})
          </strong>

          {unpaidLearners.length === 0 ? (
            <p className="db-helper" style={{ marginTop: "10px" }}>
              Everyone appears paid for the selected month.
            </p>
          ) : (
            <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
              {unpaidLearners.map((learner) => (
                <div key={learner.id} className="db-list-card">
                  <strong style={{ fontSize: "16px" }}>
                    {learner.name || "Unnamed learner"}
                  </strong>
                  <p style={textStyle}>
                    Parent Phone: {learner.parent_phone || "Not added"}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                      marginTop: "10px",
                    }}
                  >
                    <button
                      type="button"
                      className="db-button-primary"
                      onClick={() => sendPaymentReminderWhatsApp(learner)}
                    >
                      Send via WhatsApp
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="db-card db-card-lavender" style={{ padding: "20px" }}>
        <h3 style={sectionTitle}>Payment History ({payments.length})</h3>

        {payments.length === 0 ? (
          <p className="db-helper">No payments recorded yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {payments.map((payment) => (
              <div key={payment.id} className="db-list-card">
                <strong style={{ fontSize: "17px" }}>
                  {payment.learner_name || "Unnamed learner"}
                </strong>
                <p style={textStyle}>
                  Amount:{" "}
                  {payment.amount !== null && payment.amount !== undefined
                    ? `R${Number(payment.amount).toFixed(2)}`
                    : "Not set"}
                </p>
                <p style={textStyle}>
                  Payment Date: {payment.payment_date || "Not set"}
                </p>
                <p style={textStyle}>
                  Month/Year: {payment.payment_month || "-"} / {payment.payment_year || "-"}
                </p>
                <p style={textStyle}>
                  Status: {payment.status || "Not set"}
                </p>
                <p style={metaTextStyle}>
                  {payment.created_at
                    ? new Date(payment.created_at).toLocaleString()
                    : "No timestamp"}
                </p>
              </div>
            ))}
          </div>
        )}
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
        borderRadius: "22px",
        padding: "18px",
        boxShadow: "0 8px 18px rgba(45, 42, 62, 0.05)",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "#5B5675",
          fontSize: "14px",
          fontWeight: 700,
        }}
      >
        {label}
      </p>
      <h2
        style={{
          margin: "8px 0 0 0",
          color: "#2D2A3E",
          fontSize: "30px",
          fontWeight: 800,
        }}
      >
        {value}
      </h2>
      <p
        style={{
          margin: "8px 0 0 0",
          color: "#6D6888",
          fontSize: "13px",
          lineHeight: 1.5,
        }}
      >
        {helper}
      </p>
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
  margin: "8px 0 0 0",
  color: "var(--db-text-soft)",
  lineHeight: 1.6,
};

const metaTextStyle = {
  margin: "10px 0 0 0",
  color: "#8A84A3",
  fontSize: "12px",
};