"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import RouteStateCard from "../components/RouteStateCard";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { getCurrentProfile } from "../lib/auth";
import { isGradeRClassroom } from "../lib/classroom-programme";
import { chooseWorkbookLanguage, chooseWorkbookYear, workbookYears, type WorkbookCatalogueItem } from "../lib/grade-r-workbooks";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";
import { useSearchParams } from "next/navigation";

type Resource = WorkbookCatalogueItem & { resource_type: string; description?: string | null; source_name?: string | null; catalogue_status?: string | null };
type GradeRLanguageSettings = { grade_r_home_language: string; grade_r_first_additional_language: string };

export default function GradeRLearningPage() {
  const params = useSearchParams();
  const [hasGradeR, setHasGradeR] = useState<boolean | null>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [collections, setCollections] = useState<Resource[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [language, setLanguage] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { profile } = await getCurrentProfile();
    const context = await resolveSchoolContext(params.get("school"));
    if (!profile || !context.schoolId) { setHasGradeR(false); return; }
    setSchoolId(context.schoolId);
    const { data } = await supabase.from("classrooms").select("classroom_name").eq("school_id", context.schoolId);
    const gradeRExists = (data || []).some((room) => isGradeRClassroom(room.classroom_name));
    setHasGradeR(gradeRExists);
    if (!gradeRExists) return;
    const [resourcesResponse, settingsResponse] = await Promise.all([
      authenticatedFetch(`/api/learning-resources?school_id=${context.schoolId}`),
      authenticatedFetch(`/api/grade-r-settings?school_id=${context.schoolId}`),
    ]);
    const [resourcesBody, settingsBody] = await Promise.all([resourcesResponse.json(), settingsResponse.json()]);
    if (!resourcesResponse.ok) { setMessage(resourcesBody.error || "DBE workbooks could not be loaded."); return; }
    const workbooks = (resourcesBody.workbook_resources || resourcesBody.resources || []) as Resource[];
    const defaultYear = chooseWorkbookYear(workbooks, Number(resourcesBody.default_year) || null);
    const settings = (settingsResponse.ok ? settingsBody.settings : {}) as Partial<GradeRLanguageSettings>;
    setResources(workbooks);
    setCollections((resourcesBody.resources || []).filter((item: Resource) => item.resource_type !== "DBE Workbook"));
    setYear(defaultYear);
    setLanguage(chooseWorkbookLanguage(workbooks, defaultYear, settings.grade_r_home_language));
  }, [params]);
  useEffect(() => { const timer = setTimeout(() => void load().catch(() => { setMessage("Workbooks could not be loaded. Please refresh and try again."); setHasGradeR(true); }), 0); return () => clearTimeout(timer); }, [load]);

  const years = useMemo(() => workbookYears(resources), [resources]);
  const languages = useMemo(() => [...new Set(resources.filter((resource) => resource.academic_year === year).map((resource) => resource.language).filter((value): value is string => Boolean(value)))].sort(), [resources, year]);
  const visible = useMemo(() => resources.filter((resource) => {
    if (resource.academic_year !== year || resource.language !== language) return false;
    const query = search.trim().toLowerCase();
    return !query || [resource.title, resource.book_number, resource.term ? `term ${resource.term}` : "", ...(resource.learning_areas || [])].some((value) => String(value || "").toLowerCase().includes(query));
  }), [language, resources, search, year]);

  if (hasGradeR === null) return <RouteStateCard eyebrow="Daily Classroom" title="Grade R Learning Hub" message="Loading learning resources." busy />;
  if (!hasGradeR) return <div className="db-card db-card-yellow" style={{ padding: 20 }}><h1 className="db-page-title">Grade R Learning Hub</h1><p className="db-helper">Create a Grade R classroom first to enable this learning hub.</p></div>;
  return <div className="db-page-shell">
    <section className="db-page-header db-card-blue db-grade-r-hub-header"><p className="db-eyebrow">Daily Classroom</p><h1>Grade R Learning Hub</h1><p className="db-page-subtitle">Open integrated DBE workbooks and connect selected pages to the existing classroom and homework workflows.</p></section>
    <nav className="db-learning-hub-actions" aria-label="Grade R Learning Hub actions">
      <a className="db-learning-hub-action db-card-lavender" href="#grade-r-resources"><strong>DBE Workbooks</strong><span>Browse by year, book and language</span></a>
      <Link className="db-learning-hub-action db-card-blue" href={`/classroom-activities?school=${schoolId}`}><strong>Classroom Activities</strong><span>Plan or update the day</span></Link>
      <Link className="db-learning-hub-action db-card-green" href={`/classroom-activities?school=${schoolId}`}><strong>Homework</strong><span>Create or review homework</span></Link>
    </nav>
    <section id="grade-r-resources" className="db-card" style={{ padding: 18 }}>
      <p className="db-eyebrow">DBE Workbooks</p><h2 style={{ margin: "0 0 6px" }}>{year || new Date().getFullYear()} DBE Grade R Workbooks</h2>
      <p className="db-helper" style={{ marginTop: 0 }}>Each language edition is one integrated workbook containing Home Language, Mathematics and Life Skills. DailyBloom provides access and workflow integration; the Department of Basic Education remains the source.</p>
      {message ? <p className="db-status-message">{message}</p> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, margin: "14px 0" }}>
        {years.length > 1 ? <label><strong>Academic year</strong><select className="db-input" value={year || ""} onChange={(event) => { const nextYear = Number(event.target.value); setYear(nextYear); setLanguage(chooseWorkbookLanguage(resources, nextYear, language)); }} aria-label="Academic year">{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label> : null}
        <label><strong>Workbook language</strong><select className="db-input" value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Workbook language">{languages.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><strong>Search workbooks</strong><input className="db-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Book, term or learning area" /></label>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {visible.map((resource) => <article key={resource.id} className="db-list-card" style={{ padding: 14 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><div><strong>{resource.book_number || resource.title}</strong><p className="db-helper" style={{ margin: "5px 0" }}>Grade R · {resource.term ? `Term ${resource.term}` : "Term not specified"} · {resource.language}</p><p className="db-helper" style={{ margin: 0 }}>Learning areas: {(resource.learning_areas?.length ? resource.learning_areas : ["Home Language", "Mathematics", "Life Skills"]).join(" · ")}</p><p className="db-helper" style={{ margin: "5px 0 0" }}>Source: {resource.source_name || "Department of Basic Education"}</p></div><Link className="db-button-primary" href={`/grade-r-learning/reader?resource_id=${resource.id}&school_id=${schoolId}`}>Open Workbook</Link></div></article>)}
        {!visible.length ? <div className="db-card db-card-yellow" style={{ padding: 16 }}><strong>No verified workbook edition is available for this selection.</strong><p className="db-helper" style={{ marginBottom: 0 }}>The platform administrator must verify the official source or cached PDF before it is shown here.</p></div> : null}
      </div>
    </section>
    {collections.length ? <section className="db-card" style={{ padding: 18 }}><h2>Learning Resources</h2><p className="db-helper">Existing DailyBloom activity collections</p>{collections.map((item) => <div className="db-list-card" key={item.id}><Link href={`/classroom-activities?school=${schoolId}`}>{item.title}</Link></div>)}</section> : null}
  </div>;
}
