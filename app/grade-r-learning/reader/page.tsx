"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function GradeRWorkbookReaderPage() {
  const params = useSearchParams();
  const sourceUrl = params.get("url") || "";
  const title = params.get("title") || "Grade R Workbook";
  const pageFrom = params.get("page_from");
  return <div>
    <div className="db-soft-card" style={{ padding: 18, marginBottom: 14 }}><Link href="/grade-r-learning" className="db-button-secondary">Back to Learning Hub</Link><h1 className="db-page-title">{title}</h1>{pageFrom ? <p className="db-page-subtitle">Open at assigned page {pageFrom}. Use the PDF viewer page controls to navigate.</p> : null}</div>
    {sourceUrl ? <iframe title={title} src={`${sourceUrl}${pageFrom ? `#page=${encodeURIComponent(pageFrom)}` : ""}`} style={{ width: "100%", minHeight: "78vh", border: "1px solid #d8d2e5", borderRadius: 12 }} /> : <p className="db-helper">Workbook link is unavailable.</p>}
  </div>;
}
