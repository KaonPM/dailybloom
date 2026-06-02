"use client";

import { useEffect, useState } from "react";
import { checkSchoolAccess } from "../lib/access-control";

type SubscriptionGuardProps = {
  schoolId: number | null;
  featureKey: string;
  children: React.ReactNode;
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
      if (!schoolId) {
        setAllowed(false);
        setReason("No school is linked to this account.");
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

  if (checking) {
    return <p className="db-helper">Checking subscription access...</p>;
  }

  if (!allowed) {
    return (
      <div className="db-card db-card-yellow" style={{ padding: "22px" }}>
        <h2 className="db-page-title">Feature Locked</h2>
        <p className="db-page-subtitle">
          {reason || "This feature is not available for this school."}
        </p>

        {planName && (
          <p className="db-helper">
            Current package: <strong>{planName}</strong>
          </p>
        )}

        <p className="db-helper">
          Please contact DailyBloom support or upgrade the school package.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}