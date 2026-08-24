"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveSchoolContext } from "../lib/school-context";
import SubscriptionGuard from "../components/SubscriptionGuard";
import { authenticatedFetch } from "../lib/authenticated-fetch";

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
  payment_method?: string | null;
  reference_number?: string | null;
};

type LearnerItem = {
  id: string;
  name?: string | null;
  parent_phone?: string | null;
  school_id?: number | null;
  monthly_fee?: number | null;
};

type SchoolItem = {
  id: number;
  school_name?: string | null;
};

type StatementDelivery = {
  id: string;
  status?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
  error_message?: string | null;
  recipient_phone?: string | null;
};

const paymentMethods = ["Cash", "EFT", "Debit Order", "Bank Deposit", "Other"];
const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
  const [paymentMonth, setPaymentMonth] = useState(String(today.getMonth() + 1));
  const [paymentYear, setPaymentYear] = useState(String(today.getFullYear()));
  const [parentPhone, setParentPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [referenceNumber, setReferenceNumber] = useState("");

  const [selectedReminderMonth, setSelectedReminderMonth] = useState(
    String(today.getMonth() + 1)
  );
  const [selectedReminderYear, setSelectedReminderYear] = useState(
    String(today.getFullYear())
  );

  const [historyFromDate, setHistoryFromDate] = useState(todayDate);
  const [historyToDate, setHistoryToDate] = useState(todayDate);
  const [paymentHistoryPage, setPaymentHistoryPage] = useState(1);
  const paymentHistoryPageSize = 10;

  const [showRecordForm, setShowRecordForm] = useState(false);
  const [showUnpaidLearners, setShowUnpaidLearners] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [statementLearnerId, setStatementLearnerId] = useState("");
  const [statementDelivery, setStatementDelivery] = useState<StatementDelivery | null>(null);
  const [statementDeliveryLoading, setStatementDeliveryLoading] = useState(false);
  const [statementSending, setStatementSending] = useState(false);
  const [statementMessage, setStatementMessage] = useState("");
  const [statementMessageType, setStatementMessageType] = useState<"success" | "error" | "">("");
  const [reconciliationLearnerId, setReconciliationLearnerId] = useState("");
  const [reconciliationYear, setReconciliationYear] = useState(String(today.getFullYear()));
  const [journalType, setJournalType] = useState<"debit" | "credit">("debit");
  const [journalScope, setJournalScope] = useState("opening_balance");
  const [journalAmount, setJournalAmount] = useState("");
  const [journalDate, setJournalDate] = useState(todayDate);
  const [journalMonth, setJournalMonth] = useState(String(today.getMonth() + 1));
  const [journalYear, setJournalYear] = useState(String(today.getFullYear()));
  const [journalReason, setJournalReason] = useState("");
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [reconciliationMessage, setReconciliationMessage] = useState("");
  const [reconciliationMessageType, setReconciliationMessageType] = useState<"success" | "error" | "">("");
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [showJournalForm, setShowJournalForm] = useState(false);

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
    setPaymentHistoryPage(1);
  }, [historyFromDate, historyToDate]);

  useEffect(() => {
    setStatementMessage("");
    setStatementMessageType("");
    if (!schoolId || !statementLearnerId) {
      setStatementDelivery(null);
      return;
    }
    void fetchStatementDelivery(schoolId, statementLearnerId);
  }, [schoolId, statementLearnerId]);

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
      .select("id, name, parent_phone, school_id, monthly_fee")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as LearnerItem[]);
  }

  async function fetchStatementDelivery(currentSchoolId: number, learnerId: string) {
    setStatementDeliveryLoading(true);
    try {
      const params = new URLSearchParams({
        school_id: String(currentSchoolId),
        learner_id: learnerId,
        communication_type: "fee_statement",
        page: "1",
        page_size: "1",
      });
      const response = await authenticatedFetch(`/api/communications/notification-centre?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Statement delivery history could not be loaded.");
      setStatementDelivery((body.notifications?.[0] || null) as StatementDelivery | null);
    } catch (error) {
      setStatementDelivery(null);
      setStatementMessage(error instanceof Error ? error.message : "Statement delivery history could not be loaded.");
      setStatementMessageType("error");
    } finally {
      setStatementDeliveryLoading(false);
    }
  }

  async function sendStatementNotification() {
    if (!schoolId || !statementLearnerId) return;
    setStatementSending(true);
    setStatementMessage("");
    setStatementMessageType("");
    try {
      const response = await authenticatedFetch("/api/notifications/parent-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "fee_statement",
          school_id: schoolId,
          learner_id: statementLearnerId,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The fee statement notification could not be sent.");
      setStatementMessage(body.skipped
        ? "The statement is available in the Parent Portal, but push delivery was skipped because the parent has no active notification subscription."
        : "Fee statement notification sent to the parent.");
      setStatementMessageType("success");
      await fetchStatementDelivery(schoolId, statementLearnerId);
    } catch (error) {
      setStatementMessage(error instanceof Error ? error.message : "The fee statement notification could not be sent.");
      setStatementMessageType("error");
    } finally {
      setStatementSending(false);
    }
  }

  const selectedStatementLearner = learners.find((learner) => learner.id === statementLearnerId) || null;

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

    if (
      Number.isNaN(parsedAmount) ||
      parsedAmount <= 0
    ) {
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

    const learner = learners.find(
      (item) =>
        String(item.name || "").trim().toLowerCase() ===
        learnerName.trim().toLowerCase()
    );

    if (!learner) {
      alert("Please select a learner from this school.");
      setLoading(false);
      return;
    }

    let response: Response;
    try {
      response = await authenticatedFetch("/api/learner-fees/record-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: Number(schoolId),
          learner_id: learner.id,
          payment_amount: parsedAmount,
          payment_date: paymentDate,
          payment_month: parsedMonth,
          payment_year: parsedYear,
          payment_method: paymentMethod,
          reference_number: referenceNumber.trim() || null,
        }),
      });
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Could not record payment.");
      setLoading(false);
      return;
    }
    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Could not record payment.");
      setLoading(false);
      return;
    }

    setLearnerName("");
    setAmount("");
    setPaymentDate(todayDate);
    setPaymentMonth(String(today.getMonth() + 1));
    setPaymentYear(String(today.getFullYear()));
    setParentPhone("");
    setPaymentMethod("Cash");
    setReferenceNumber("");

    await fetchPayments(Number(schoolId));

    setLoading(false);
    setLastSavedSuccess(true);
    setShowRecordForm(false);
  }

  async function createYearSchedule() {
    if (!schoolId) return;
    const year = Number(reconciliationYear);
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      setReconciliationMessage("Enter a valid billing year.");
      setReconciliationMessageType("error");
      return;
    }
    setReconciliationLoading(true);
    setReconciliationMessage("");
    try {
      const response = await authenticatedFetch("/api/learner-fees/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_year_schedule", school_id: schoolId, year }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create the annual schedule.");
      setReconciliationMessage(`${result.planned_charge_count || 0} January-December fee periods are now available. Future months remain scheduled until their normal billing month.`);
      setReconciliationMessageType("success");
    } catch (error) {
      setReconciliationMessage(error instanceof Error ? error.message : "Could not create the annual schedule.");
      setReconciliationMessageType("error");
    } finally {
      setReconciliationLoading(false);
    }
  }

  async function recordJournal() {
    if (!schoolId || !reconciliationLearnerId || !journalAmount || !journalReason.trim()) {
      setReconciliationMessage("Choose a learner and complete the amount and reason.");
      setReconciliationMessageType("error");
      return;
    }
    const parsedAmount = Number(journalAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setReconciliationMessage("Enter a valid journal amount.");
      setReconciliationMessageType("error");
      return;
    }
    setReconciliationLoading(true);
    setReconciliationMessage("");
    try {
      const allocationPeriod = `${journalYear}-${String(journalMonth).padStart(2, "0")}-01`;
      const response = await authenticatedFetch("/api/learner-fees/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_journal", school_id: schoolId, learner_id: reconciliationLearnerId,
          entry_type: journalType, entry_scope: journalScope, amount: parsedAmount,
          effective_date: journalDate, allocation_period: allocationPeriod,
          reason: journalReason.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not record the journal.");
      setJournalAmount("");
      setJournalReason("");
      setReconciliationMessage(`${journalType === "debit" ? "Debit" : "Credit"} journal recorded. The latest learner statement now reflects it.`);
      setReconciliationMessageType("success");
      await fetchPayments(schoolId);
    } catch (error) {
      setReconciliationMessage(error instanceof Error ? error.message : "Could not record the journal.");
      setReconciliationMessageType("error");
    } finally {
      setReconciliationLoading(false);
    }
  }

  function openHistoricalPaymentCapture() {
    const learner = learners.find((item) => item.id === reconciliationLearnerId);
    if (learner?.name) handleLearnerSelection(learner.name);
    setShowRecordForm(true);
    setHighlightRecordForm(true);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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

  const totalPaymentHistoryPages = Math.max(
    1,
    Math.ceil(filteredPaymentHistory.length / paymentHistoryPageSize)
  );

  const paginatedPaymentHistory = filteredPaymentHistory.slice(
    (paymentHistoryPage - 1) * paymentHistoryPageSize,
    paymentHistoryPage * paymentHistoryPageSize
  );

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
    <SubscriptionGuard schoolId={schoolId} featureKey="payment_tracking">
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
                    {months[month - 1]}
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
              <p style={labelText}>Payment Amount</p>
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
              <p style={labelText}>Payment Method</p>
              <select
                className="db-input"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p style={labelText}>Reference Number</p>
              <input
                className="db-input"
                placeholder="Reference, receipt or transaction number"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
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
                    {months[month - 1]}
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
              className="db-collapse-action db-section-toggle"
              onClick={() => setShowUnpaidLearners((prev) => !prev)}
            >
              {showUnpaidLearners ? "Close" : `Open unpaid (${unpaidLearners.length})`}
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

        <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
          <div style={sectionHeader}><div><h3 style={sectionTitle}>Learner Fee Statements</h3><p style={smallText}>1. Select learner. 2. Create/view the current statement. 3. Send its Parent Portal message.</p></div></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: 14, marginTop: 12, alignItems: "stretch" }}>
            <label style={{ display: "grid", gap: 6 }}><span style={labelText}>Learner</span><select className="db-input" value={statementLearnerId} onChange={(event) => setStatementLearnerId(event.target.value)}><option value="">Select learner</option>{learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.name || "Unnamed learner"}</option>)}</select></label>
            <div className="db-soft-card" style={{ padding: 14, boxShadow: "none" }}>
              {!selectedStatementLearner ? <p style={smallText}>Select a learner to see the statement delivery history.</p> : statementDeliveryLoading ? <p style={smallText}>Loading delivery history...</p> : statementDelivery ? <><strong>{statementDeliveryStatusLabel(statementDelivery.status)}</strong><p style={smallText}>Last attempt: {formatStatementDeliveryDate(statementDelivery.sent_at || statementDelivery.created_at)}</p><p style={smallText}>Parent contact: {statementDelivery.recipient_phone || selectedStatementLearner.parent_phone || "Not added"}</p>{statementDelivery.error_message ? <p style={{ ...smallText, color: "#a33a3a" }}>{statementDelivery.error_message}</p> : null}</> : <><strong>Not sent yet</strong><p style={smallText}>The statement is available in the Parent Portal, but no statement notification has been recorded.</p></>}
            </div>
            <div className="db-soft-card" style={{ padding: 14, boxShadow: "none", display: "grid", alignContent: "center", gap: 10 }}><strong>Statement actions</strong><button type="button" className="db-button-secondary" disabled={!statementLearnerId || !schoolId} onClick={() => router.push(`/payments/statement?school=${schoolId}&learner=${encodeURIComponent(statementLearnerId)}`)}>Create / view statement</button><button type="button" className="db-button-primary" disabled={!statementLearnerId || !schoolId || statementSending} onClick={() => void sendStatementNotification()}>{statementSending ? "Sending..." : statementDelivery ? "Resend to Parent Portal" : "Send to Parent Portal"}</button></div>
          </div>
          {statementMessage ? <div className={statementMessageType === "error" ? "db-error-banner" : "db-success-banner"} role={statementMessageType === "error" ? "alert" : "status"} style={{ marginTop: 12 }}>{statementMessage}</div> : null}
        </div>

        <div className="db-card db-card-green" style={{ padding: 16, marginBottom: 18 }}>
          <div style={sectionHeader}>
            <div>
              <h3 style={sectionTitle}>Statement &amp; Reconciliation</h3>
              <p style={smallText}>Set up historic fees and payments once, then let monthly billing continue as normal.</p>
            </div>
            <button type="button" className="db-collapse-action db-section-toggle" onClick={() => setShowReconciliation((current) => !current)}>
              {showReconciliation ? "Close reconciliation" : "Open reconciliation"}
            </button>
          </div>

          {showReconciliation ? <>
            <div className="db-soft-card" style={{ padding: 14, marginTop: 12, boxShadow: "none" }}>
              <h4 style={{ ...sectionTitle, fontSize: 16 }}>Historical account setup</h4>
              <ol style={{ ...smallText, paddingLeft: 20, marginBottom: 0 }}>
                <li>Create the January-December fee schedule once. It adds January to the current month to the live account and keeps future months scheduled.</li>
                <li>Use <strong>Record Payment</strong> for each historic payment, select its actual payment date and the school-fee month it settles.</li>
                <li>Use the journal only for an opening balance, registration fee, or a correction. It is an audit adjustment, not the everyday payment screen.</li>
              </ol>
              <div style={{ ...formGrid, marginTop: 12 }}>
                <label><span style={labelText}>Billing year</span><input className="db-input" type="number" value={reconciliationYear} onChange={(event) => setReconciliationYear(event.target.value)} /></label>
                <label><span style={labelText}>Learner for historic payment</span><select className="db-input" value={reconciliationLearnerId} onChange={(event) => setReconciliationLearnerId(event.target.value)}><option value="">Select learner</option>{learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.name || "Unnamed learner"}</option>)}</select></label>
                <div style={{ alignSelf: "end" }}><button type="button" className="db-button-secondary" disabled={!schoolId || reconciliationLoading} onClick={() => void createYearSchedule()}>{reconciliationLoading ? "Working..." : "Create January-December Schedule"}</button></div>
                <div style={{ alignSelf: "end" }}><button type="button" className="db-button-secondary" disabled={!reconciliationLearnerId} onClick={openHistoricalPaymentCapture}>Capture historic payment</button></div>
              </div>
            </div>

            <div className="db-soft-card" style={{ padding: 14, marginTop: 12, boxShadow: "none" }}>
              <div style={sectionHeader}><div><h4 style={{ ...sectionTitle, fontSize: 16 }}>Manual adjustment journal</h4><p style={smallText}>For opening balances, registration fees and corrections only. Entries are closed and immutable after saving.</p></div><button type="button" className="db-collapse-action db-section-toggle" onClick={() => setShowJournalForm((current) => !current)}>{showJournalForm ? "Close journal" : "Open journal"}</button></div>
              {showJournalForm ? <><div style={{ ...formGrid, marginTop: 12 }}>
                <label><span style={labelText}>Learner</span><select className="db-input" value={reconciliationLearnerId} onChange={(event) => setReconciliationLearnerId(event.target.value)}><option value="">Select learner</option>{learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.name || "Unnamed learner"}</option>)}</select></label>
                <label><span style={labelText}>Entry type</span><select className="db-input" value={journalType} onChange={(event) => setJournalType(event.target.value as "debit" | "credit")}><option value="debit">Debit — adds to balance</option><option value="credit">Credit — reduces balance</option></select></label>
                <label><span style={labelText}>Applies to</span><select className="db-input" value={journalScope} onChange={(event) => setJournalScope(event.target.value)}><option value="opening_balance">Opening balance</option><option value="monthly_fee">School fees</option><option value="registration_fee">Registration fee</option><option value="correction">Correction</option></select></label>
                <label><span style={labelText}>Amount</span><input className="db-input" type="number" min="0" step="0.01" value={journalAmount} onChange={(event) => setJournalAmount(event.target.value)} placeholder="Amount" /></label>
                <label><span style={labelText}>Effective date</span><input className="db-input" type="date" max={todayDate} value={journalDate} onChange={(event) => setJournalDate(event.target.value)} /></label>
                <label><span style={labelText}>Allocation month</span><select className="db-input" value={journalMonth} onChange={(event) => setJournalMonth(event.target.value)}>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label>
                <label><span style={labelText}>Allocation year</span><input className="db-input" type="number" value={journalYear} onChange={(event) => setJournalYear(event.target.value)} /></label>
                <label><span style={labelText}>Reason / source record</span><input className="db-input" value={journalReason} onChange={(event) => setJournalReason(event.target.value)} placeholder="e.g. 2026 fee register" /></label>
              </div><button type="button" className="db-button-primary" disabled={reconciliationLoading} onClick={() => void recordJournal()}>{reconciliationLoading ? "Recording..." : `Record ${journalType === "debit" ? "Debit" : "Credit"} Journal`}</button></> : null}
            </div>
            {reconciliationMessage ? <div className={reconciliationMessageType === "error" ? "db-error-banner" : "db-success-banner"} role={reconciliationMessageType === "error" ? "alert" : "status"} style={{ marginTop: 12 }}>{reconciliationMessage}</div> : null}
          </> : null}
        </div>

        <div className="db-card db-card-lavender" style={{ padding: 16 }}>
          <div style={sectionHeader}>
            <div>
              <h3 style={sectionTitle}>Payment History ({filteredPaymentHistory.length})</h3>
              <p style={smallText}>Open only when you need to review payment records.</p>
            </div>

            <button
              type="button"
              className="db-collapse-action db-section-toggle"
              onClick={() => setShowPaymentHistory((prev) => !prev)}
            >
              {showPaymentHistory ? "Close" : "Open history"}
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
                <>
                  <div style={{ display: "grid", gap: 8 }}>
                    {paginatedPaymentHistory.map((payment) => (
                      <div key={payment.id} style={historyRow}>
                        <div>
                          <strong>{payment.learner_name || "Unnamed learner"}</strong>
                          <p style={smallText}>
                            {payment.payment_date || "No date"} | Month{" "}
                            {payment.payment_month || "-"} / {payment.payment_year || "-"}
                          </p>
                          <p style={smallText}>
                            Method: {payment.payment_method || "Not specified"}
                          </p>
                          <p style={smallText}>
                            Reference: {payment.reference_number || "Not added"}
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

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 12,
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="db-button-secondary"
                      disabled={paymentHistoryPage === 1}
                      onClick={() =>
                        setPaymentHistoryPage((prev) => Math.max(1, prev - 1))
                      }
                    >
                      Previous
                    </button>

                    <p style={smallText}>
                      Page {paymentHistoryPage} of {totalPaymentHistoryPages}
                    </p>

                    <button
                      type="button"
                      className="db-button-secondary"
                      disabled={paymentHistoryPage === totalPaymentHistoryPages}
                      onClick={() =>
                        setPaymentHistoryPage((prev) =>
                          Math.min(totalPaymentHistoryPages, prev + 1)
                        )
                      }
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </SubscriptionGuard>
  );
}

function statementDeliveryStatusLabel(status?: string | null) {
  if (status === "read") return "Statement notification read";
  if (status === "delivered") return "Statement notification delivered";
  if (status === "sent") return "Statement notification sent";
  if (status === "skipped") return "Push notification not sent";
  if (status === "failed") return "Statement notification failed";
  if (status === "queued" || status === "sending" || status === "retry_scheduled") return "Statement notification pending";
  return "Statement delivery recorded";
}

function formatStatementDeliveryDate(value?: string | null) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
