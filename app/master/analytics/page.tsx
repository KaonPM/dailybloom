"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentProfile } from "../../lib/auth";

type SchoolRow = {
  id: number;
  school_name?: string | null;
  is_active?: boolean | null;
  billing_status?: string | null;
  status?: string | null;
  package_name?: string | null;
  registration_status?: string | null;
  wageflow_enabled?: boolean | null;
};

type SubscriptionRow = {
  school_id?: number | null;
  plan_name?: string | null;
  monthly_price?: number | null;
  status?: string | null;
  next_billing_date?: string | null;
};

export default function MasterAnalyticsPage() {
  const router = useRouter();

  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [learnersCount, setLearnersCount] = useState(0);
  const [teachersCount, setTeachersCount] = useState(0);
  const [classroomsCount, setClassroomsCount] = useState(0);
  const [paymentsCount, setPaymentsCount] = useState(0);
  const [summariesCount, setSummariesCount] = useState(0);
  const [showOverviewCards, setShowOverviewCards] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const { profile, error } = await getCurrentProfile();

    if (error || !profile) {
      router.push("/login");
      return;
    }

    if (profile.role !== "master") {
      router.push("/dashboard");
      return;
    }

    const [
      schoolsResult,
      subscriptionsResult,
      learnersResult,
      teachersResult,
      classroomsResult,
      paymentsResult,
      summariesResult,
    ] = await Promise.all([
      supabase
        .from("schools")
        .select("id, school_name, is_active, billing_status, status, package_name, registration_status, wageflow_enabled"),

      supabase
        .from("school_subscriptions")
        .select("school_id, plan_name, monthly_price, status, next_billing_date"),

      supabase.from("learners").select("id", { count: "exact", head: true }),

      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "teacher"),

      supabase.from("classrooms").select("id", { count: "exact", head: true }),

      supabase.from("payments").select("id", { count: "exact", head: true }),

      supabase.from("summaries").select("id", { count: "exact", head: true }),
    ]);

    if (schoolsResult.error) alert(schoolsResult.error.message);
    if (subscriptionsResult.error) alert(subscriptionsResult.error.message);
    if (learnersResult.error) alert(learnersResult.error.message);
    if (teachersResult.error) alert(teachersResult.error.message);
    if (classroomsResult.error) alert(classroomsResult.error.message);
    if (paymentsResult.error) alert(paymentsResult.error.message);
    if (summariesResult.error) alert(summariesResult.error.message);

    setSchools((schoolsResult.data || []) as SchoolRow[]);
    setSubscriptions((subscriptionsResult.data || []) as SubscriptionRow[]);
    setLearnersCount(learnersResult.count || 0);
    setTeachersCount(teachersResult.count || 0);
    setClassroomsCount(classroomsResult.count || 0);
    setPaymentsCount(paymentsResult.count || 0);
    setSummariesCount(summariesResult.count || 0);

    setLoading(false);
  }

  const analytics = useMemo(() => {
    const totalSchools = schools.length;

    const activeSchools = subscriptions.filter(
      (item) => String(item.status || "").toLowerCase() === "active"
    ).length;

    const trialSchools = subscriptions.filter(
      (item) => String(item.status || "").toLowerCase() === "trial"
    ).length;

    const overdueSchools = subscriptions.filter(
      (item) => String(item.status || "").toLowerCase() === "overdue"
    ).length;

    const cancelledSchools = subscriptions.filter(
      (item) => String(item.status || "").toLowerCase() === "cancelled"
    ).length;

    const expectedMonthlyRevenue = subscriptions
      .filter((item) =>
        ["active", "trial"].includes(String(item.status || "").toLowerCase())
      )
      .reduce((sum, item) => sum + Number(item.monthly_price || 0), 0);

    const bloomSchools = subscriptions.filter(
      (item) => item.plan_name === "Bloom"
    ).length;

    const bloomProSchools = subscriptions.filter(
      (item) => item.plan_name === "Bloom Pro"
    ).length;

    const bloomEliteSchools = subscriptions.filter(
      (item) => item.plan_name === "Bloom Elite"
    ).length;

    const wageflowEnabledSchools = schools.filter(
      (school) => school.wageflow_enabled
    ).length;

    const incompleteRegistrations = schools.filter((school) => {
      const status = String(school.registration_status || "").toLowerCase();
      return status && status !== "complete" && status !== "completed";
    }).length;

    return {
      totalSchools,
      activeSchools,
      trialSchools,
      overdueSchools,
      cancelledSchools,
      expectedMonthlyRevenue,
      annualRevenue: expectedMonthlyRevenue * 12,
      bloomSchools,
      bloomProSchools,
      bloomEliteSchools,
      wageflowEnabledSchools,
      incompleteRegistrations,
    };
  }, [schools, subscriptions]);

  const schoolsNeedingAttention = useMemo(() => {
    return schools
      .map((school) => {
        const subscription = subscriptions.find(
          (item) => Number(item.school_id) === Number(school.id)
        );

        return {
          school,
          subscription,
        };
      })
      .filter((entry) => {
        const subStatus = String(entry.subscription?.status || "").toLowerCase();
        const registrationStatus = String(
          entry.school.registration_status || ""
        ).toLowerCase();

        return (
          subStatus === "overdue" ||
          subStatus === "cancelled" ||
          (registrationStatus &&
            registrationStatus !== "complete" &&
            registrationStatus !== "completed")
        );
      });
  }, [schools, subscriptions]);

  if (loading) {
    return <p>Loading platform analytics...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="db-page-title">Platform Analytics</h2>
        <p className="db-page-subtitle">
          Master overview of schools, subscriptions, usage and platform health.
        </p>
      </div>

      <div className="db-card db-card-blue" style={{ padding: 18 }}>
        <div style={sectionHeader}>
          <div>
            <h3 style={sectionTitle}>Platform Overview</h3>
            <p style={smallText}>
              View schools, subscriptions, revenue and platform usage.
            </p>
          </div>

          <button
            type="button"
            className="db-button-secondary"
            onClick={() => setShowOverviewCards((prev) => !prev)}
          >
            {showOverviewCards ? "Hide Overview" : "View Overview"}
          </button>
        </div>

        {showOverviewCards ? (
          <div style={{ ...grid, marginTop: 14 }}>
            <InsightCard title="Total Schools" value={analytics.totalSchools} helper="Schools on DailyBloom" />
            <InsightCard title="Active Subscriptions" value={analytics.activeSchools} helper="Currently active schools" />
            <InsightCard title="Trial Schools" value={analytics.trialSchools} helper="Schools on trial" />
            <InsightCard title="Overdue Schools" value={analytics.overdueSchools} helper="Need billing follow-up" />
            <InsightCard title="Cancelled Schools" value={analytics.cancelledSchools} helper="No longer active" />
            <InsightCard title="Monthly Revenue" value={`R${analytics.expectedMonthlyRevenue.toFixed(2)}`} helper="Expected monthly revenue" />
            <InsightCard title="Annual Revenue" value={`R${analytics.annualRevenue.toFixed(2)}`} helper="Projected annual revenue" />
            <InsightCard title="Total Learners" value={learnersCount} helper="Across all schools" />
            <InsightCard title="Total Teachers" value={teachersCount} helper="Across all schools" />
            <InsightCard title="Classrooms" value={classroomsCount} helper="Across all schools" />
            <InsightCard title="Payment Records" value={paymentsCount} helper="Total payment entries" />
            <InsightCard title="Daily Summaries" value={summariesCount} helper="Total summaries saved" />
          </div>
        ) : null}
      </div>

      <div className="db-card db-card-lavender" style={{ padding: 18, marginTop: 18 }}>
        <h3 style={sectionTitle}>Subscription Breakdown</h3>

        <div style={grid}>
          <InsightCard title="Bloom" value={analytics.bloomSchools} helper="Starter package" />
          <InsightCard title="Bloom Pro" value={analytics.bloomProSchools} helper="Growth package" />
          <InsightCard title="Bloom Elite" value={analytics.bloomEliteSchools} helper="Premium package" />
          <InsightCard title="WageFlow Enabled" value={analytics.wageflowEnabledSchools} helper="Schools with WageFlow active" />
        </div>
      </div>

      <div className="db-card db-card-yellow" style={{ padding: 18, marginTop: 18 }}>
        <h3 style={sectionTitle}>Schools Needing Attention</h3>

        {schoolsNeedingAttention.length === 0 ? (
          <p className="db-helper">No schools currently need attention.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {schoolsNeedingAttention.map((entry) => (
              <div key={entry.school.id} style={schoolRow}>
                <div>
                  <strong>{entry.school.school_name || "Unnamed school"}</strong>
                  <p style={smallText}>
                    Subscription: {entry.subscription?.status || "No subscription"}
                  </p>
                  <p style={smallText}>
                    Registration: {entry.school.registration_status || "Not set"}
                  </p>
                </div>

                <span style={pill}>
                  {entry.subscription?.plan_name || entry.school.package_name || "No package"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InsightCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="db-card db-card-blue" style={{ padding: 16 }}>
      <strong>{title}</strong>
      <p style={cardValue}>{value}</p>
      <p style={smallText}>{helper}</p>
    </div>
  );
}

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap" as const,
};

const sectionTitle = {
  margin: "0 0 12px 0",
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 800 as const,
};

const cardValue = {
  margin: "8px 0 0 0",
  fontSize: 28,
  fontWeight: 800,
  color: "#2D2A3E",
};

const smallText = {
  margin: "5px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
  lineHeight: 1.4,
};

const schoolRow = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 14,
  padding: "12px 14px",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap" as const,
};

const pill = {
  background: "#EAF7FD",
  border: "1px solid #CBEAF7",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  fontWeight: 700,
};