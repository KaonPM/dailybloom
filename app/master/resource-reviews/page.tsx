"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "../../lib/authenticated-fetch";

type Review = { id: number; title: string; source_name: string; source_url: string; academic_year: number; review_notes?: string | null; status: string; detected_at: string };

export default function LearningResourceReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    const response = await authenticatedFetch("/api/learning-resource-reviews");
    const body = await response.json();
    setReviews(response.ok ? body.reviews || [] : []);
    setMessage(response.ok ? "" : body.error || "Reviews could not be loaded.");
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  async function decide(id: number, status: "approved" | "rejected") {
    const response = await authenticatedFetch("/api/learning-resource-reviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    const body = await response.json();
    setMessage(response.ok ? `Resource update ${status}.` : body.error || "Decision could not be saved.");
    if (response.ok) await load();
  }
  if (loading) return <p>Loading resource update reviews...</p>;
  return <div><div className="db-soft-card" style={{ padding: 20, marginBottom: 16 }}><p className="db-eyebrow">Master Admin</p><h1 className="db-page-title">DBE Resource Update Reviews</h1><p className="db-page-subtitle">Approve verified official updates before they are published to the Grade R Learning Hub.</p></div>{message ? <p className="db-helper">{message}</p> : null}<div style={{ display: "grid", gap: 12 }}>{reviews.length ? reviews.map((review) => <div className="db-card" style={{ padding: 16 }} key={review.id}><strong>{review.title}</strong><p className="db-helper">{review.source_name} · {review.academic_year} · {review.status}</p>{review.review_notes ? <p className="db-helper">{review.review_notes}</p> : null}<a className="db-button-secondary" href={review.source_url} target="_blank" rel="noreferrer">Check official source</a>{review.status === "pending" ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}><button className="db-button-primary" onClick={() => void decide(review.id, "approved")}>Approve and publish</button><button className="db-button-secondary" onClick={() => void decide(review.id, "rejected")}>Reject</button></div> : null}</div>) : <div className="db-card" style={{ padding: 16 }}><p className="db-helper">No DBE resource updates are awaiting review.</p></div>}</div></div>;
}
