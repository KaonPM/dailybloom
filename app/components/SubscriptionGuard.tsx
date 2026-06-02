"use client";

import { useEffect, useState } from "react";
import { checkSchoolAccess } from "../lib/access-control";

type SubscriptionGuardProps = {
  schoolId: number | null;
  featureKey: string;
  children: React.ReactNode;
};

const FEATURE_LABELS: Record<string, string> = {
  payments: "Payment Tracking",
  payment_reminders: "Parent Payment Reminders",
  daily_summaries: "Daily Summaries",
  progress_reports: "Developmental Progress Reports",
  awards: "Achievement Awards",
  learner_requirements: "Learner Requirements Tracking",
  grade_rr: "Grade RR Readiness Tracking",
  advanced_reporting: "Advanced Reporting",
  comprehensive_grade_rr_reports: "Comprehensive Grade RR Reports",
  analytics: "Advanced School Analytics",
  custom_reports: "Custom Report Generation",
  wageflow: "WageFlow Integration",
  ai_features: "AI-Powered Features",
  whatsapp_automation: "WhatsApp Automation",
};

const FEATURE_REQUIRED_PLAN: Record<string, string> = {
  payments: "Bloom Pro",
  payment_reminders: "Bloom Pro",
  daily_summaries: "Bloom Pro",
  progress_reports: "Bloom Pro",
  awards: "Bloom Pro",
  learner_requirements: "Bloom Pro",
  grade_rr: "Bloom Pro",
  advanced_reporting: "Bloom Pro",
  comprehensive_grade_rr_reports: "Bloom Elite",
  analytics: "Bloom Elite",
  custom_reports: "Bloom Elite",
  wageflow: "Bloom Elite",
  ai_features: "Bloom Elite",
  whatsapp_automation: "Bloom Elite",
};

export default function SubscriptionGuard({
  schoolId,
  featureKey,
  children,
}: SubscriptionGuardProps) {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    async function checkAccess() {
      setChecking(true);

      if (!schoolId) {
        setAllowed(false);
        setReason("No school is linked to this account.");
        setPlanName(null);
        setChecking(false);
        return;
      }

      const access = await checkSchoolAccess(schoolId, featureKey);

      setAllowed(access.allowed);
      setReason(access.reason);
      setPlanName(access.planName);
      setChecking(false);
    }

    checkAccess();
  }, [schoolId, featureKey]);

  const featureName = FEATURE_LABELS[featureKey] || "This feature";
  const requiredPlan = FEATURE_REQUIRED_PLAN[featureKey];

  if (checking) {
    return (
      <div className="db-card db-card-blue" style={{ padding: "22px" }}>
        <p className="db-helper" style={{ margin: 0 }}>
          Checking your DailyBloom package access...
        </p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="db-card db-card-yellow" style={{ padding: "24px" }}>
        <h2 className="db-page-title" style={{ marginBottom: "8px" }}>
          Upgrade Required
        </h2>

        <p className="db-page-subtitle" style={{ marginBottom: "14px" }}>
          {featureName} is not included in your current DailyBloom package.
        </p>

        {planName && (
          <p className="db-helper" style={{ marginBottom: "8px" }}>
            Current package: <strong>{planName}</strong>
          </p>
        )}

        {requiredPlan && (
          <p className="db-helper" style={{ marginBottom: "8px" }}>
            Required package: <strong>{requiredPlan}</strong> or higher
          </p>
        )}

        <p className="db-helper" style={{ marginTop: "14px", marginBottom: 0 }}>
          To unlock this feature, upgrade your school to{" "}
          <strong>{requiredPlan || "a higher package"}</strong>. This helps your
          preschool access more tools for parent communication, learner records,
          reporting, and school management.
        </p>

        {reason && (
          <p className="db-helper" style={{ marginTop: "12px", marginBottom: 0 }}>
            {reason}
          </p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}