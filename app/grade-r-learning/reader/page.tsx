"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { normalizeSelectedPages, selectedPagesLabel, workbookPagesFromQuery } from "@/app/lib/grade-r-workbooks";

type Resource = { id: number; title: string; academic_year?: number | null; grade?: string | null; term?: number | null; book_number?: string | null; language?: string | null; source_name?: string | null; page_count?: number | null };
type LoadedPdf = PDFDocumentProxy & { destroy: () => void | Promise<void> };

function destroyLoadedPdf(document: LoadedPdf | undefined) {
  if (document && typeof document.destroy === "function") void document.destroy();
}

export default function GradeRWorkbookReaderPage() {
  const params = useSearchParams();
  const pathname = usePathname();
  const resourceId = Number(params.get("resource_id"));
  const schoolId = Number(params.get("school_id"));
  const assignmentId = Number(params.get("assignment_id"));
  const learnerId = params.get("learner_id") || "";
  const initialPages = useMemo(() => workbookPagesFromQuery(params.get("pages"), params.get("page_from"), params.get("page_to")), [params]);
  const [resource, setResource] = useState<Resource | null>(null);
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [page, setPage] = useState(initialPages[0] || 1);
  const [selectedPages, setSelectedPages] = useState<number[]>(initialPages);
  const [scale, setScale] = useState(1.15);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState("Loading workbook...");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!resourceId || !schoolId) { setMessage("This workbook link is invalid."); return; }
    let active = true;
    let loadedDocument: LoadedPdf | undefined;
    void (async () => {
      try {
        if (!assignmentId) {
          const metadata = await authenticatedFetch(`/api/learning-resources?school_id=${schoolId}&resource_id=${resourceId}`);
          const body = await metadata.json();
          if (!metadata.ok || !body.resources?.[0]) throw new Error(body.error || "Workbook information is unavailable.");
          if (active) setResource(body.resources[0]);
        } else {
          setResource({ id: resourceId, title: params.get("title") || "DBE Grade R Workbook", academic_year: Number(params.get("year")) || null, grade: "Grade R", language: params.get("language") });
        }
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const access = assignmentId ? `&assignment_id=${assignmentId}&learner_id=${encodeURIComponent(learnerId)}` : "";
        const contentUrl = `/api/learning-resources/${resourceId}/content?school_id=${schoolId}${access}`;
        const response = await (assignmentId ? fetch(contentUrl, { cache: "no-store", credentials: "include" }) : authenticatedFetch(contentUrl));
        if (!response.ok) throw new Error("This workbook is temporarily unavailable. Please contact your DailyBloom administrator.");
        const content = await response.json();
        if (active) setResource(content.resource);
        const document = await pdfjs.getDocument({ url: content.url, disableAutoFetch: true, disableStream: true, disableRange: Boolean(assignmentId), withCredentials: Boolean(assignmentId), wasmUrl: "/pdfjs/wasm/" }).promise as LoadedPdf;
        loadedDocument = document;
        if (active) { setPdf(document); setPage((current) => Math.min(current, document.numPages)); setSelectedPages((current) => normalizeSelectedPages(current, document.numPages)); setMessage(""); }
        else destroyLoadedPdf(document);
      } catch {
        if (active) setMessage("This workbook is temporarily unavailable. Please try again later or contact your DailyBloom administrator.");
      }
    })();
    return () => { active = false; destroyLoadedPdf(loadedDocument); };
  }, [assignmentId, learnerId, params, resourceId, schoolId]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    void (async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        if (cancelled || !canvasRef.current) return;
        const pageWidth = pdfPage.getViewport({ scale: 1 }).width;
        const availableWidth = Math.max(1, canvasRef.current.parentElement?.clientWidth || pageWidth);
        const viewport = pdfPage.getViewport({ scale: Math.min(scale, availableWidth / pageWidth) });
        const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4_000_000 / (viewport.width * viewport.height)));
        const canvas = canvasRef.current;
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.maxWidth = "100%";
        canvas.style.height = "auto";
        const context = canvas.getContext("2d");
        if (!context) return;
        task = pdfPage.render({ canvas, canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
        await task.promise;
        if (!cancelled) setMessage("");
      } catch { if (!cancelled) setMessage("This workbook page could not be displayed. Please try another page."); }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [page, pdf, scale]);

  const togglePage = () => setSelectedPages((current) => current.includes(page) ? current.filter((item) => item !== page) : normalizeSelectedPages([...current, page], pdf?.numPages));
  const resourceQuery = new URLSearchParams({ school: String(schoolId), resource_id: String(resourceId), page_from: String(selectedPages[0] || page), page_to: String(selectedPages.at(-1) || page), selected_pages: (selectedPages.length ? selectedPages : [page]).join(",") });
  const isParent = Boolean(assignmentId);
  const isClassroomActivity = pathname.startsWith("/classroom-activities/");
  const backHref = isParent ? "/parent/homework" : isClassroomActivity ? `/classroom-activities?school=${schoolId}` : "/grade-r-learning";
  const backLabel = isParent ? "Back to Homework" : isClassroomActivity ? "Back to Classroom Activities" : "Back to DBE Workbooks";

  async function printWorkbookPages() {
    if (!pdf || printing) return;
    const printablePages = isParent
      ? initialPages.length ? initialPages : [page]
      : selectedPages.length ? selectedPages : [page];
    const pages = normalizeSelectedPages(printablePages, pdf.numPages);
    const printWindow = window.open("", "_blank", "popup,width=900,height=900");
    if (!printWindow) {
      setMessage("The print window was blocked. Allow pop-ups for DailyBloom and try again.");
      return;
    }

    printWindow.opener = null;
    setPrinting(true);
    setMessage("");
    try {
      const printDocument = printWindow.document;
      printDocument.open();
      printDocument.write(`<!doctype html><html><head><meta charset="utf-8"><title>Preparing printable workbook</title><style>
        * { box-sizing: border-box; }
        body { display: grid; min-height: 100vh; margin: 0; padding: 24px; place-items: center; color: #171717; background: #f7f4ef; font-family: Arial, sans-serif; text-align: center; }
        main { max-width: 520px; padding: 28px; border: 1px solid #e3d9cd; border-radius: 20px; background: white; }
        h1 { margin: 0 0 10px; font-size: 22px; }
        p { margin: 0; color: #5f5964; font-size: 15px; }
      </style></head><body><main><h1 id="title"></h1><p id="status">Preparing a printable PDF…</p></main></body></html>`);
      printDocument.close();
      const title = printDocument.getElementById("title");
      if (title) title.textContent = resource?.title || "DailyBloom homework";
      const printablePdf = await pdf.extractPages([{ document: null, includePages: pages.map((pageNumber) => pageNumber - 1) }]);
      if (!printablePdf.length) throw new Error("Printable PDF could not be prepared.");
      const status = printDocument.getElementById("status");
      if (status) status.textContent = `${selectedPagesLabel(pages)} ready. Opening the browser print viewer…`;
      const printableUrl = URL.createObjectURL(new Blob([new Uint8Array(printablePdf)], { type: "application/pdf" }));
      printWindow.location.replace(printableUrl);
      window.setTimeout(() => URL.revokeObjectURL(printableUrl), 300_000);
    } catch {
      printWindow.close();
      setMessage("The assigned workbook pages could not be prepared as a printable PDF. Please try again.");
    } finally {
      setPrinting(false);
    }
  }

  return <div className="db-page-shell">
    <section className="db-page-header db-card-blue"><Link href={backHref} className="db-main-pill">{backLabel}</Link><p className="db-eyebrow" style={{ marginTop: 14 }}>Department of Basic Education</p><h1>{resource?.title || "Grade R Workbook"}</h1><p className="db-page-subtitle">{resource?.academic_year || ""} {resource?.grade || "Grade R"}{resource?.book_number ? ` · ${resource.book_number}` : ""}{resource?.term ? ` · Term ${resource.term}` : ""}{resource?.language ? ` · ${resource.language}` : ""}</p></section>
    {message ? <div className="db-card db-card-yellow" style={{ padding: 18 }}><strong>{message}</strong>{!pdf ? <p className="db-helper">The original DBE workbook has not been changed. Try again later or ask the platform administrator to verify its source file.</p> : null}</div> : null}
    {pdf ? <>
      <section className="db-card" style={{ padding: 12, position: "sticky", top: 0, zIndex: 3 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" }}><button className="db-button-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><label>Page <input className="db-input" style={{ width: 82 }} type="number" min="1" max={pdf.numPages} value={page} onChange={(event) => setPage(Math.min(pdf.numPages, Math.max(1, Number(event.target.value) || 1)))} /> of {pdf.numPages}</label><button className="db-button-secondary" disabled={page >= pdf.numPages} onClick={() => setPage((current) => Math.min(pdf.numPages, current + 1))}>Next</button><button className="db-button-secondary" onClick={() => setScale((current) => Math.max(.65, current - .15))}>Zoom out</button><button className="db-button-secondary" onClick={() => setScale((current) => Math.min(2.2, current + .15))}>Zoom in</button><button className={selectedPages.includes(page) ? "db-button-primary" : "db-button-secondary"} onClick={togglePage}>{selectedPages.includes(page) ? `Page ${page} selected` : `Select page ${page}`}</button><button className="db-button-primary" disabled={printing} onClick={() => void printWorkbookPages()}>{printing ? "Preparing PDF…" : isParent ? "Print assigned pages" : "Print selected pages"}</button></div></section>
      <section className="db-card" style={{ marginTop: 10, padding: 10, overflow: "auto", textAlign: "center", background: "#EEEAE5" }}><canvas ref={canvasRef} aria-label={`Workbook page ${page}`} /></section>
      <section className="db-card db-card-lavender" style={{ padding: 14, position: "sticky", bottom: 8, zIndex: 3 }}><strong>{selectedPagesLabel(selectedPages)}</strong>{!isParent ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}><Link className="db-button-primary" href={`/classroom-activities?${resourceQuery}`}>Add to Classroom Activity</Link><Link className="db-button-primary" href={`/classroom-activities?${resourceQuery}&homework=1`}>Add to Homework</Link></div> : null}</section>
    </> : null}
  </div>;
}
