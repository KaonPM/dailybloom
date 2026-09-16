"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import RouteStateCard from "../components/RouteStateCard";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { getCurrentProfile } from "../lib/auth";
import { isGradeRClassroom } from "../lib/classroom-programme";
import { chooseWorkbookYear, schoolWorkbookLanguageAvailability, workbookYears, type WorkbookCatalogueItem } from "../lib/grade-r-workbooks";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";
import { useSearchParams } from "next/navigation";

type Resource = WorkbookCatalogueItem & { resource_type: string; description?: string | null; source_name?: string | null; catalogue_status?: string | null; learning_area?: string | null; topic?: string | null };
type GradeRLanguageSettings = { grade_r_home_language: string; grade_r_first_additional_language: string };

export default function GradeRLearningPage() {
  const params = useSearchParams();
  const [hasGradeR, setHasGradeR] = useState<boolean | null>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [collections, setCollections] = useState<Resource[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [languageSelection, setLanguageSelection] = useState("school");
  const [schoolLanguages, setSchoolLanguages] = useState<GradeRLanguageSettings>({ grade_r_home_language: "English", grade_r_first_additional_language: "Afrikaans" });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [collectionTerm, setCollectionTerm] = useState(() => Math.min(4, Math.max(1, Math.ceil((new Date().getMonth() + 1) / 3))));
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
    setSettingsLoaded(settingsResponse.ok);
    if (!settingsResponse.ok) { setMessage("School language settings could not be loaded. Showing all available editions; refresh to retry."); setLanguageSelection("all"); }
    else { setMessage(""); setLanguageSelection("school"); }
    setResources(workbooks);
    setCollections((resourcesBody.resources || []).filter((item: Resource) => item.resource_type !== "DBE Workbook"));
    setYear(defaultYear);
    setSchoolLanguages({ grade_r_home_language: settings.grade_r_home_language || "English", grade_r_first_additional_language: settings.grade_r_first_additional_language || "Afrikaans" });
  }, [params]);
  useEffect(() => { const timer = setTimeout(() => void load().catch(() => { setMessage("Workbooks could not be loaded. Please refresh and try again."); setHasGradeR(true); }), 0); return () => clearTimeout(timer); }, [load]);

  const years = useMemo(() => workbookYears(resources), [resources]);
  const languages = useMemo(() => [...new Set(resources.filter((resource) => resource.academic_year === year).map((resource) => resource.language).filter((value): value is string => Boolean(value)))].sort(), [resources, year]);
  const schoolEditions = useMemo(() => schoolWorkbookLanguageAvailability(resources, year || 0, schoolLanguages.grade_r_home_language, schoolLanguages.grade_r_first_additional_language), [resources, year, schoolLanguages]);
  const visible = useMemo(() => resources.filter((resource) => {
    if (resource.academic_year !== year || (languageSelection === "school" ? !schoolEditions.available.includes(resource.language || "") : languageSelection !== "all" && resource.language !== languageSelection)) return false;
    const query = search.trim().toLowerCase();
    return !query || [resource.title, resource.book_number, resource.term ? `term ${resource.term}` : "", ...(resource.learning_areas || [])].some((value) => String(value || "").toLowerCase().includes(query));
  }), [languageSelection, resources, schoolEditions.available, search, year]);
  const visibleCollections = useMemo(() => collections.filter((item) => item.term === collectionTerm), [collectionTerm, collections]);

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
      {settingsLoaded ? <p className="db-helper">School Setup: Home Language — <strong>{schoolLanguages.grade_r_home_language}</strong> · First Additional Language — <strong>{schoolLanguages.grade_r_first_additional_language}</strong></p> : null}
      {message ? <p className="db-status-message">{message}</p> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, margin: "14px 0" }}>
        {years.length > 1 ? <label><strong>Academic year</strong><select className="db-input" value={year || ""} onChange={(event) => { setYear(Number(event.target.value)); setLanguageSelection(settingsLoaded ? "school" : "all"); }} aria-label="Academic year">{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label> : null}
        <label><strong>Workbook languages</strong><select className="db-input" value={languageSelection} onChange={(event) => setLanguageSelection(event.target.value)} aria-label="Workbook languages"><option value="school">School languages</option><option value="all">All available languages</option>{languages.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><strong>Search workbooks</strong><input className="db-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Book, term or learning area" /></label>
      </div>
      {languageSelection === "school" && schoolEditions.missing.length ? <p role="status" className="db-status-message">No verified {year} workbook edition is available yet for {schoolEditions.missing.join(" and ")}. Master must verify and publish the official PDF before it appears here.</p> : null}
      <div style={{ display: "grid", gap: 10 }}>
        {visible.map((resource) => <article key={resource.id} className="db-list-card" style={{ padding: 14 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><div><strong>{resource.book_number || resource.title}</strong><p className="db-helper" style={{ margin: "5px 0" }}>Grade R · {resource.term ? `Term ${resource.term}` : "Term not specified"} · {resource.language}{resource.language?.localeCompare(schoolLanguages.grade_r_home_language, undefined, { sensitivity: "accent" }) === 0 ? " · Home Language" : resource.language?.localeCompare(schoolLanguages.grade_r_first_additional_language, undefined, { sensitivity: "accent" }) === 0 ? " · First Additional Language" : ""}</p><p className="db-helper" style={{ margin: 0 }}>Learning areas: {(resource.learning_areas?.length ? resource.learning_areas : ["Home Language", "Mathematics", "Life Skills"]).join(" · ")}</p><p className="db-helper" style={{ margin: "5px 0 0" }}>Source: {resource.source_name || "Department of Basic Education"}</p></div><Link className="db-button-primary" href={`/grade-r-learning/reader?resource_id=${resource.id}&school_id=${schoolId}`}>Open Workbook</Link></div></article>)}
        {!visible.length ? <div className="db-card db-card-yellow" style={{ padding: 16 }}><strong>No verified workbook edition is available for this selection.</strong><p className="db-helper" style={{ marginBottom: 0 }}>The platform administrator must verify the official source or cached PDF before it is shown here.</p></div> : null}
      </div>
    </section>
    {collections.length ? <details className="db-card" style={{ padding: 18 }}><summary style={{ cursor: "pointer", fontWeight: 800, fontSize: "1.25rem" }}>DailyBloom activity collections</summary><p className="db-helper">Choose the school term, then open a collection to see matching activities in the Grade R Activity Library. The term gives the recommended teaching focus; practitioners may reuse an activity in another term when it suits the learners.</p><label><strong>Term</strong><select className="db-input" style={{ maxWidth: 220 }} value={collectionTerm} onChange={(event) => setCollectionTerm(Number(event.target.value))}>{[1, 2, 3, 4].map((term) => <option key={term} value={term}>Term {term}</option>)}</select></label><div style={{ display: "grid", gap: 10, marginTop: 12 }}>{visibleCollections.map((item) => <article className="db-list-card" key={item.id}><strong>{item.learning_area || item.title}</strong><p className="db-helper" style={{ margin: "5px 0" }}>Term {item.term} · {item.topic || "Grade R activities"}</p><Link className="db-button-secondary" href={`/classroom-activities?school=${schoolId}&section=library&collection_term=${item.term}&collection_area=${encodeURIComponent(item.learning_area || "")}`}>Open matching activities</Link></article>)}</div></details> : null}
  </div>;
}
