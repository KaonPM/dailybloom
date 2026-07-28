"use client";

import { useEffect } from "react";
import RouteStateCard from "./components/RouteStateCard";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[DailyBloom route error]", {
      digest: error.digest || null,
      message: error.message,
    });
  }, [error]);

  return (
    <RouteStateCard
      eyebrow="Something went wrong"
      title="This page could not be opened"
      message="Your information has not been removed. Try opening the page again, or return to the dashboard."
      accent="var(--db-coral)"
      actions={
        <>
          <button className="db-button-primary" onClick={unstable_retry}>
            Try Again
          </button>
          <a className="db-button-secondary" href="/dashboard">
            Return to Dashboard
          </a>
        </>
      }
    />
  );
}
