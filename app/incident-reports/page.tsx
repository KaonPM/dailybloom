"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { resolveSchoolContext } from "../lib/school-context";
import { authenticatedFetch } from "../lib/authenticated-fetch";

type Learner = {
  id: string;
  name?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  classroom_id?: number | null;
  classrooms?: { classroom_name?: string | null } | { classroom_name?: string | null }[] | null;
};

type ProfileRow = {
  id: string;
  role?: string | null;
  full_name?: string | null;
  classroom_id?: number | null;
  classroom_name?: string | null;
};

type IncidentReport = {
  id: number;
  school_id: number;
  learner_id?: string | null;
  learner_name?: string | null;
  classroom_name?: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  report_reference?: string | null;
  incident_date?: string | null;
  incident_time?: string | null;
  incident_location?: string | null;
  incident_type?: string | null;
  description?: string | null;
  first_aid_given?: string | null;
  action_taken?: string | null;
  parent_notified?: boolean | null;
  parent_notified_at?: string | null;
  witness_name?: string | null;
  front_injury_areas?: string[] | null;
  back_injury_areas?: string[] | null;
  photo_urls?: string[] | null;
  status?: string | null;
  principal_acknowledged_at?: string | null;
  principal_acknowledged_by?: string | null;
  principal_notes?: string | null;
  urgency?: string | null;
  injury_occurred?: string | null;
  injured_person?: string | null;
  injury_description?: string | null;
  medical_assistance_required?: boolean | null;
  immediate_safety_risk?: boolean | null;
  behaviour_trigger?: string | null;
  behaviour_duration?: string | null;
  people_affected?: string | null;
  deescalation_used?: string | null;
  settling_support?: string | null;
  learner_support_required?: boolean | null;
  follow_up_owner?: string | null;
  follow_up_due_date?: string | null;
  resolution_notes?: string | null;
  parent_contact_name?: string | null;
  parent_contact_method?: string | null;
  parent_contact_outcome?: string | null;
  parent_contact_notes?: string | null;
  parent_contacted_by?: string | null;
  parent_portal_message?: string | null;
  parent_portal_published_at?: string | null;
  parent_acknowledged_at?: string | null;
  parent_acknowledged_by?: string | null;
  parent_comment?: string | null;
  created_at?: string | null;
};

const incidentTypes = [
  "Accident or injury", "Illness or medical", "Disruptive behaviour",
  "Aggressive behaviour", "Bullying or peer conflict", "Safeguarding concern",
  "Property damage", "Other",
];

const behaviourTypes = new Set([
  "Disruptive behaviour", "Aggressive behaviour", "Bullying or peer conflict",
]);

const frontAreas = [
  "Head/face",
  "Neck/chest",
  "Stomach",
  "Left arm",
  "Right arm",
  "Left hand",
  "Right hand",
  "Left leg",
  "Right leg",
  "Left foot",
  "Right foot",
];

const backAreas = [
  "Back of head",
  "Neck/back",
  "Lower back",
  "Left shoulder",
  "Right shoulder",
  "Left arm/back",
  "Right arm/back",
  "Left leg/back",
  "Right leg/back",
  "Left foot/back",
  "Right foot/back",
];

export default function IncidentReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const today = new Date().toISOString().split("T")[0];
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [learnerId, setLearnerId] = useState("");
  const [incidentDate, setIncidentDate] = useState(today);
  const [incidentTime, setIncidentTime] = useState(nowTime);
  const [incidentLocation, setIncidentLocation] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [description, setDescription] = useState("");
  const [firstAidGiven, setFirstAidGiven] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [parentNotified, setParentNotified] = useState(false);
  const [parentNotifiedAt, setParentNotifiedAt] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [urgency, setUrgency] = useState("routine");
  const [injuryOccurred, setInjuryOccurred] = useState("no");
  const [injuryDescription, setInjuryDescription] = useState("");
  const [medicalAssistanceRequired, setMedicalAssistanceRequired] = useState(false);
  const [immediateSafetyRisk, setImmediateSafetyRisk] = useState(false);
  const [behaviourTrigger, setBehaviourTrigger] = useState("");
  const [behaviourDuration, setBehaviourDuration] = useState("");
  const [peopleAffected, setPeopleAffected] = useState("");
  const [deescalationUsed, setDeescalationUsed] = useState("");
  const [settlingSupport, setSettlingSupport] = useState("");
  const [learnerSupportRequired, setLearnerSupportRequired] = useState(false);
  const [frontInjuries, setFrontInjuries] = useState<string[]>([]);
  const [backInjuries, setBackInjuries] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);

  const selectedLearner = useMemo(
    () => learners.find((item) => String(item.id) === String(learnerId)) || null,
    [learners, learnerId]
  );

  const canCreate = profile?.role === "teacher" || profile?.role === "principal" || profile?.role === "master";
  const canAcknowledge = profile?.role === "principal" || profile?.role === "master";
  const filteredReports = reports.filter((report) => {
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "urgent" && report.urgency === "urgent" && report.status !== "resolved")
      || (statusFilter === "awaiting_parent" && Boolean(report.parent_portal_published_at) && !report.parent_acknowledged_at)
      || report.status === statusFilter;
    return matchesStatus && (typeFilter === "all" || report.incident_type === typeFilter);
  });
  const submittedReports = filteredReports.filter((report) => report.status !== "resolved");
  const acknowledgedReports = filteredReports.filter((report) => report.status === "resolved");
  const isBehaviourIncident = behaviourTypes.has(incidentType);
  const showInjuryFields = incidentType === "Accident or injury" || injuryOccurred !== "no";

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const [{ profile: currentProfile }, context] = await Promise.all([
      getCurrentProfile(),
      resolveSchoolContext(schoolParam),
    ]);

    if (!currentProfile || context.error) {
      router.push("/login");
      return;
    }

    if (context.shouldReturnToMaster || !context.schoolId) {
      router.push("/master");
      return;
    }

    setProfile(currentProfile);
    setSchoolId(context.schoolId);

    await Promise.all([
      fetchLearners(context.schoolId, currentProfile),
      fetchReports(context.schoolId),
    ]);

    setLoading(false);
  }

  async function fetchLearners(currentSchoolId: number, currentProfile = profile) {
    let query = supabase
      .from("learners")
      .select("id, name, parent_name, parent_phone, classroom_id, classrooms:classroom_id(classroom_name)")
      .eq("school_id", currentSchoolId)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("name", { ascending: true });

    if (currentProfile?.role === "teacher" && currentProfile.classroom_name) {
      query = query.eq("class", currentProfile.classroom_name);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as Learner[]);
  }

  async function fetchReports(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("incident_reports")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Incident reports fetch error:", error);
      setReports([]);
      return;
    }

    setReports((data || []) as IncidentReport[]);
  }

  function resetForm() {
    setLearnerId("");
    setIncidentDate(today);
    setIncidentTime(nowTime);
    setIncidentLocation("");
    setIncidentType("");
    setDescription("");
    setFirstAidGiven("");
    setActionTaken("");
    setParentNotified(false);
    setParentNotifiedAt("");
    setWitnessName("");
    setUrgency("routine");
    setInjuryOccurred("no");
    setInjuryDescription("");
    setMedicalAssistanceRequired(false);
    setImmediateSafetyRisk(false);
    setBehaviourTrigger("");
    setBehaviourDuration("");
    setPeopleAffected("");
    setDeescalationUsed("");
    setSettlingSupport("");
    setLearnerSupportRequired(false);
    setFrontInjuries([]);
    setBackInjuries([]);
    setPhotos([]);

    const input = document.getElementById("incident-photos") as HTMLInputElement | null;
    if (input) input.value = "";
  }

  function toggleArea(area: string, side: "front" | "back") {
    const setter = side === "front" ? setFrontInjuries : setBackInjuries;

    setter((current) =>
      current.includes(area)
        ? current.filter((item) => item !== area)
        : [...current, area]
    );
  }

  function handlePhotosChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith("image/") && file.size <= 5 * 1024 * 1024
    ).slice(0, 2);
    if (files.length !== Math.min(event.target.files?.length || 0, 2)) {
      alert("Only image files up to 5 MB each can be attached.");
    }
    setPhotos(files);
  }

  async function uploadPhotos(currentSchoolId: number) {
    const urls: string[] = [];

    for (const file of photos) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${currentSchoolId}/${Date.now()}-${safeName}`;

      const { error } = await supabase.storage
        .from("incident-report-photos")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw error;
      }

      urls.push(path);
    }

    return urls;
  }

  async function submitIncidentReport() {
    if (!schoolId || !profile) return;

    if (!selectedLearner || !incidentDate || !incidentTime || !incidentLocation.trim() || !incidentType.trim() || !description.trim()) {
      alert("Please complete learner, date, time, location, incident type, and description.");
      return;
    }

    setSaving(true);
    let uploadedPhotoPaths: string[] = [];

    try {
      const photoUrls = await uploadPhotos(schoolId);
      uploadedPhotoPaths = photoUrls;
      const principalCreatedReport = canAcknowledge;
      const classroom = Array.isArray(selectedLearner.classrooms)
        ? selectedLearner.classrooms[0]
        : selectedLearner.classrooms;

      const { error } = await supabase.from("incident_reports").insert([
        {
          school_id: schoolId,
          learner_id: selectedLearner.id,
          learner_name: selectedLearner.name || null,
          classroom_name: classroom?.classroom_name || null,
          teacher_id: profile.id,
          teacher_name: profile.full_name || null,
          report_reference: `DSD-2022-${Date.now()}`,
          incident_date: incidentDate,
          incident_time: incidentTime,
          incident_location: incidentLocation.trim(),
          incident_type: incidentType.trim(),
          description: description.trim(),
          first_aid_given: firstAidGiven.trim() || null,
          action_taken: actionTaken.trim() || null,
          urgency,
          injury_occurred: injuryOccurred,
          injury_description: injuryDescription.trim() || null,
          medical_assistance_required: medicalAssistanceRequired,
          immediate_safety_risk: immediateSafetyRisk,
          behaviour_trigger: behaviourTrigger.trim() || null,
          behaviour_duration: behaviourDuration.trim() || null,
          people_affected: peopleAffected.trim() || null,
          deescalation_used: deescalationUsed.trim() || null,
          settling_support: settlingSupport.trim() || null,
          learner_support_required: learnerSupportRequired,
          parent_notified: parentNotified,
          parent_notified_at: parentNotifiedAt || null,
          witness_name: witnessName.trim() || null,
          front_injury_areas: frontInjuries,
          back_injury_areas: backInjuries,
          photo_urls: photoUrls,
          status: "submitted",
        },
      ]);

      if (error) {
        throw error;
      }

      resetForm();
      setShowForm(false);
      setSelectedReport(null);
      await fetchReports(schoolId);
      alert(principalCreatedReport ? "Incident report saved for review." : "Incident report submitted to principal.");
    } catch (error: unknown) {
      if (uploadedPhotoPaths.length > 0) {
        await supabase.storage.from("incident-report-photos").remove(uploadedPhotoPaths);
      }
      alert(error instanceof Error ? error.message : "Could not submit incident report.");
    } finally {
      setSaving(false);
    }
  }

  async function acknowledgeReport(report: IncidentReport) {
    if (!schoolId || !profile) return;

    setAcknowledgingId(report.id);

    const { error } = await supabase
      .from("incident_reports")
      .update({
        status: "under_review",
        principal_acknowledged_at: new Date().toISOString(),
        principal_acknowledged_by: profile.full_name || profile.id,
        principal_notes: acknowledgeNotes.trim() || null,
      })
      .eq("id", report.id)
      .eq("school_id", schoolId);

    if (error) {
      alert(error.message);
      setAcknowledgingId(null);
      return;
    }

    setAcknowledgeNotes("");
    await fetchReports(schoolId);
    setSelectedReport(null);
    setAcknowledgingId(null);
    alert("Incident report moved to under review.");
  }

  async function updateWorkflow(report: IncidentReport, updates: Record<string, unknown>, action: string) {
    if (!schoolId || !profile) return;
    setAcknowledgingId(report.id);
    const timestamped = { ...updates, updated_at: new Date().toISOString(), updated_by: profile.id };
    const { error } = await supabase.from("incident_reports").update(timestamped)
      .eq("id", report.id).eq("school_id", schoolId);
    if (!error) {
      await supabase.from("incident_report_audit").insert({
        incident_report_id: report.id, school_id: schoolId, action,
        actor_id: profile.id, actor_name: profile.full_name || null, details: updates,
      });
      await fetchReports(schoolId);
      setSelectedReport(null);
    } else alert(error.message);
    setAcknowledgingId(null);
  }

  async function recordParentCall(report: IncidentReport) {
    if (!profile?.id) return;
    const contactName = prompt("Parent/guardian contacted:", report.parent_contact_name || "");
    if (contactName === null) return;
    const outcome = prompt("Call outcome (Reached, No answer, Message left):", report.parent_contact_outcome || "Reached");
    if (outcome === null) return;
    const notes = prompt("Brief call notes (internal):", report.parent_contact_notes || "");
    await updateWorkflow(report, {
      parent_notified: outcome.toLowerCase() === "reached",
      parent_notified_at: new Date().toISOString(), parent_contact_name: contactName.trim(),
      parent_contact_method: "Phone call", parent_contact_outcome: outcome.trim(),
      parent_contact_notes: notes?.trim() || null, parent_contacted_by: profile.full_name || profile.id,
    }, "parent_contact_recorded");
  }

  async function publishToParent(report: IncidentReport) {
    if (!profile?.id) return;
    if (!report.parent_notified_at) {
      const proceed = confirm("No parent call has been recorded. Publish anyway and record that the parent could not be reached?");
      if (!proceed) return;
    }
    const message = prompt("Parent-facing message (internal notes and photos are not included):", report.parent_portal_message || "Please review and acknowledge receipt of this incident report.");
    if (message === null) return;
    const now = new Date().toISOString();
    await updateWorkflow(report, {
      parent_portal_message: message.trim(), parent_portal_published_at: now,
      parent_portal_published_by: profile.full_name || profile.id,
    }, "published_to_parent_portal");
    const learner = learners.find((item) => String(item.id) === String(report.learner_id));
    authenticatedFetch("/api/notifications/parent-push", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "incident_report", school_id: schoolId, parent_phone: learner?.parent_phone,
        learner_name: report.learner_name }) }).catch(() => undefined);
    alert("Incident report published securely to the Parent Portal.");
  }

  async function openSecurePhoto(path: string) {
    if (/^https?:\/\//i.test(path)) {
      window.open(path, "_blank", "noopener,noreferrer");
      return;
    }
    const { data, error } = await supabase.storage.from("incident-report-photos").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      alert(error?.message || "This attachment could not be opened.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function renderReportList(list: IncidentReport[], emptyText: string) {
    if (list.length === 0) {
      return <p className="db-helper">{emptyText}</p>;
    }

    return (
      <div style={{ display: "grid", gap: 10 }}>
        {list.map((report) => {
          const active = selectedReport?.id === report.id;
          const acknowledged = report.status === "resolved";

          return (
            <div key={report.id}>
              <button type="button" onClick={() => setSelectedReport(active ? null : report)} style={reportButton}>
                <strong>{report.learner_name || "Learner"} - {report.incident_type || "Incident"}</strong>
                <span style={acknowledged ? pillGreen : pillAmber}>
                  {(report.status || "submitted").replaceAll("_", " ")}
                </span>
                <span style={smallText}>{report.incident_date || "No date"} {report.incident_time || ""}</span>
              </button>

              {active ? (
                <div style={reportDetail}>
                  <p style={detailText}><strong>Reference:</strong> {report.report_reference || "Not set"}</p>
                  <p style={detailText}><strong>Teacher:</strong> {report.teacher_name || "Not set"}</p>
                  <p style={detailText}><strong>Classroom:</strong> {report.classroom_name || "Not set"}</p>
                  <p style={detailText}><strong>Location:</strong> {report.incident_location || "Not set"}</p>
                  <p style={detailText}><strong>Description:</strong> {report.description || "Not set"}</p>
                  <p style={detailText}><strong>Urgency:</strong> {(report.urgency || "routine").replaceAll("_", " ")}</p>
                  {report.behaviour_trigger ? <p style={detailText}><strong>What happened beforehand:</strong> {report.behaviour_trigger}</p> : null}
                  {report.behaviour_duration ? <p style={detailText}><strong>Duration:</strong> {report.behaviour_duration}</p> : null}
                  {report.deescalation_used ? <p style={detailText}><strong>Staff response:</strong> {report.deescalation_used}</p> : null}
                  <p style={detailText}><strong>First aid:</strong> {report.first_aid_given || "Not set"}</p>
                  <p style={detailText}><strong>Action taken:</strong> {report.action_taken || "Not set"}</p>
                  <p style={detailText}><strong>Parent notified:</strong> {report.parent_notified ? "Yes" : "No"}</p>
                  <p style={detailText}><strong>Witness:</strong> {report.witness_name || "Not set"}</p>
                  <p style={detailText}><strong>Front injuries:</strong> {(report.front_injury_areas || []).join(", ") || "None marked"}</p>
                  <p style={detailText}><strong>Back injuries:</strong> {(report.back_injury_areas || []).join(", ") || "None marked"}</p>

                  {(report.photo_urls || []).length > 0 ? (
                    <div style={photoGrid}>
                      {(report.photo_urls || []).map((url) => (
                        <button type="button" key={url} style={photoLink} onClick={() => openSecurePhoto(url)}>
                          View secured attachment
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {acknowledged ? (
                    <div style={ackBox}>
                      <strong>Resolved by {report.principal_acknowledged_by || "principal"}</strong>
                      <p style={smallText}>{report.principal_notes || "No principal notes added."}</p>
                    </div>
                  ) : canAcknowledge && report.status === "submitted" ? (
                    <div style={{ marginTop: 12 }}>
                      <textarea className="db-input" rows={3} value={acknowledgeNotes} onChange={(event) => setAcknowledgeNotes(event.target.value)} placeholder="Principal notes..." style={{ resize: "vertical" }} />
                      <button type="button" className="db-button-primary" style={{ marginTop: 10 }} onClick={() => acknowledgeReport(report)} disabled={acknowledgingId === report.id}>
                        {acknowledgingId === report.id ? "Updating..." : "Start Review"}
                      </button>
                    </div>
                  ) : null}
                  {canAcknowledge ? (
                    <div style={{ ...photoGrid, marginTop: 14 }}>
                      <button type="button" className="db-button-secondary" onClick={() => recordParentCall(report)}>Record Parent Call</button>
                      <button type="button" className="db-button-secondary" onClick={() => publishToParent(report)} disabled={!report.principal_acknowledged_at}>Send to Parent Portal</button>
                      {report.status !== "resolved" ? <button type="button" className="db-button-secondary" onClick={() => updateWorkflow(report, { status: "follow_up_required" }, "follow_up_required")}>Follow-up Required</button> : null}
                      {report.status !== "resolved" ? <button type="button" className="db-button-primary" onClick={() => updateWorkflow(report, { status: "resolved", resolved_at: new Date().toISOString() }, "resolved")}>Resolve</button> : null}
                    </div>
                  ) : null}
                  {report.parent_portal_published_at ? <div style={ackBox}><strong>Sent to Parent Portal</strong><p style={smallText}>{report.parent_acknowledged_at ? `Acknowledged by ${report.parent_acknowledged_by || "parent"}` : "Awaiting parent acknowledgement"}</p>{report.parent_comment ? <p style={smallText}>Parent comment: {report.parent_comment}</p> : null}</div> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  if (loading) {
    return <p>Loading incident reports...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <div style={headerRow}>
          <div>
            <h2 className="db-page-title">Incident Reports</h2>
            <p className="db-page-subtitle">
              Record DSD 2022 incident details, injury map markings, photos, and principal acknowledgement.
            </p>
          </div>

          {canCreate ? (
            <button
              type="button"
              className="db-button-primary"
              onClick={() => setShowForm((current) => !current)}
            >
              {showForm ? "Close" : "Create Incident Report"}
            </button>
          ) : null}
        </div>
      </div>

      {showForm ? (
        <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
          <h3 style={sectionTitle}>DSD 2022 Incident Details</h3>

          <div style={grid2}>
            <Field label="Learner">
              <select className="db-input" value={learnerId} onChange={(event) => setLearnerId(event.target.value)}>
                <option value="">Select learner</option>
                {learners.map((learner) => (
                  <option key={learner.id} value={learner.id}>
                    {learner.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Incident Type">
              <select className="db-input" value={incidentType} onChange={(event) => setIncidentType(event.target.value)}>
                <option value="">Select incident type</option>
                {incidentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </Field>

            <Field label="Incident Date">
              <input className="db-input" type="date" value={incidentDate} onChange={(event) => setIncidentDate(event.target.value)} />
            </Field>

            <Field label="Incident Time">
              <input className="db-input" type="time" value={incidentTime} onChange={(event) => setIncidentTime(event.target.value)} />
            </Field>
          </div>

          <Field label="Location">
            <input className="db-input" value={incidentLocation} onChange={(event) => setIncidentLocation(event.target.value)} placeholder="Classroom, playground, bathroom..." />
          </Field>

          <Field label="Description of Incident">
            <textarea className="db-input" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} style={{ resize: "vertical" }} />
            <p style={smallText}>Record observable facts, not labels—for example, what the learner did, said and for how long.</p>
          </Field>

          <div style={grid2}>
            <Field label="Urgency">
              <select className="db-input" value={urgency} onChange={(event) => setUrgency(event.target.value)}>
                <option value="routine">Routine — managed safely</option>
                <option value="follow_up_required">Follow-up required</option>
                <option value="urgent">Urgent — immediate attention</option>
              </select>
            </Field>
            <label style={{ ...checkboxLine, marginTop: 28 }}><input type="checkbox" checked={immediateSafetyRisk} onChange={(event) => setImmediateSafetyRisk(event.target.checked)} />Immediate safety risk</label>
          </div>

          {isBehaviourIncident ? (
            <div className="db-soft-card" style={{ padding: 14, marginTop: 12 }}>
              <h4 style={bodyMapTitle}>Behaviour context and support</h4>
              <Field label="What happened immediately beforehand?">
                <textarea className="db-input" rows={2} value={behaviourTrigger} onChange={(event) => setBehaviourTrigger(event.target.value)} />
              </Field>
              <div style={grid2}>
                <Field label="Approximate duration"><input className="db-input" value={behaviourDuration} onChange={(event) => setBehaviourDuration(event.target.value)} placeholder="For example, 5 minutes" /></Field>
                <Field label="People affected (use roles, not other learners' names)"><input className="db-input" value={peopleAffected} onChange={(event) => setPeopleAffected(event.target.value)} placeholder="Another learner, staff member..." /></Field>
              </div>
              <div style={grid2}>
                <Field label="Staff response / de-escalation"><textarea className="db-input" rows={3} value={deescalationUsed} onChange={(event) => setDeescalationUsed(event.target.value)} /></Field>
                <Field label="What helped the learner settle?"><textarea className="db-input" rows={3} value={settlingSupport} onChange={(event) => setSettlingSupport(event.target.value)} /></Field>
              </div>
              <label style={{ ...checkboxLine, marginTop: 10 }}><input type="checkbox" checked={learnerSupportRequired} onChange={(event) => setLearnerSupportRequired(event.target.checked)} />Learner-support follow-up required</label>
            </div>
          ) : null}

          <Field label="Did anyone sustain an injury?">
            <select className="db-input" value={injuryOccurred} onChange={(event) => setInjuryOccurred(event.target.value)}>
              <option value="no">No</option><option value="learner">Yes — learner</option>
              <option value="another_learner">Yes — another learner</option><option value="staff">Yes — staff member</option>
              <option value="unsure">Unsure — assessment required</option>
            </select>
          </Field>

          {showInjuryFields ? <div style={grid2}>
            <Field label="First Aid Given">
              <textarea className="db-input" rows={3} value={firstAidGiven} onChange={(event) => setFirstAidGiven(event.target.value)} style={{ resize: "vertical" }} />
            </Field>

            <Field label="Action Taken / Follow Up">
              <textarea className="db-input" rows={3} value={actionTaken} onChange={(event) => setActionTaken(event.target.value)} style={{ resize: "vertical" }} />
            </Field>
            <Field label="Injury description"><textarea className="db-input" rows={3} value={injuryDescription} onChange={(event) => setInjuryDescription(event.target.value)} /></Field>
          </div> : <Field label="Action Taken / Follow Up"><textarea className="db-input" rows={3} value={actionTaken} onChange={(event) => setActionTaken(event.target.value)} /></Field>}

          <div style={grid2}>
            <label style={checkboxLine}>
              <input type="checkbox" checked={parentNotified} onChange={(event) => setParentNotified(event.target.checked)} />
              Parent notified
            </label>

            {parentNotified ? <Field label="Parent Notified At">
              <input className="db-input" type="datetime-local" value={parentNotifiedAt} onChange={(event) => setParentNotifiedAt(event.target.value)} />
            </Field> : <span />}
          </div>

          <Field label="Witness Name">
            <input className="db-input" value={witnessName} onChange={(event) => setWitnessName(event.target.value)} />
          </Field>

          {showInjuryFields ? <><label style={{ ...checkboxLine, marginTop: 12 }}><input type="checkbox" checked={medicalAssistanceRequired} onChange={(event) => setMedicalAssistanceRequired(event.target.checked)} />Medical assistance required</label><div style={bodyMapGrid}>
            <BodyMap title="Front Body Map" areas={frontAreas} selected={frontInjuries} onToggle={(area) => toggleArea(area, "front")} />
            <BodyMap title="Back Body Map" areas={backAreas} selected={backInjuries} onToggle={(area) => toggleArea(area, "back")} />
          </div></> : null}

          <Field label="Photos (up to 2)">
            <input id="incident-photos" style={hiddenFileInput} type="file" accept="image/*" multiple onChange={handlePhotosChange} />
            <label htmlFor="incident-photos" style={uploadButton}>
              Upload Photos
            </label>
            <p style={smallText}>{photos.length} selected. Up to 2 images, maximum 5 MB each. Photos remain private and are not shared with parents automatically.</p>
          </Field>

          <button type="button" className="db-button-primary" style={{ width: "100%", marginTop: 12 }} onClick={submitIncidentReport} disabled={saving}>
            {saving ? "Saving..." : (canAcknowledge ? "Save Incident Report for Review" : "Submit to Principal")}
          </button>
        </div>
      ) : null}

      <div className="db-soft-card" style={{ padding: 14, marginBottom: 18 }}>
        <div style={summaryGrid}>
          {([
            ['submitted', 'Awaiting review', reports.filter((r) => r.status === 'submitted').length, '#FFF3CD', '#8A6400'],
            ['follow_up_required', 'Follow-up', reports.filter((r) => r.status === 'follow_up_required').length, '#EAF7FD', '#23607B'],
            ['urgent', 'Urgent', reports.filter((r) => r.urgency === 'urgent' && r.status !== 'resolved').length, '#FDECEC', '#A33A3A'],
            ['awaiting_parent', 'Awaiting parent', reports.filter((r) => r.parent_portal_published_at && !r.parent_acknowledged_at).length, '#F3EDFF', '#6542A6'],
            ['resolved', 'Resolved', reports.filter((r) => r.status === 'resolved').length, '#EEF9EE', '#276738'],
          ] as [string, string, number, string, string][]).map(([filter, label, value, background, color]) => (
            <button
              key={filter}
              type="button"
              aria-pressed={statusFilter === filter}
              onClick={() => setStatusFilter((current) => current === filter ? "all" : filter)}
              style={{ ...summaryCard, background, color, ...(statusFilter === filter ? selectedSummaryCard : {}) }}
            >
              <strong style={summaryNumber}>{value}</strong>
              <span style={summaryLabel}>{label}</span>
            </button>
          ))}
        </div>
        <div style={filterGrid}>
          <Field label="Status"><select className="db-input" style={compactSelect} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="submitted">Awaiting review</option><option value="under_review">Under review</option><option value="follow_up_required">Follow-up required</option><option value="urgent">Urgent</option><option value="awaiting_parent">Awaiting parent acknowledgement</option><option value="resolved">Resolved</option></select></Field>
          <Field label="Incident type"><select className="db-input" style={compactSelect} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All incident types</option>{incidentTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field>
        </div>
      </div>

      {canAcknowledge ? (
        <div style={stack}>
          <div className="db-card db-card-yellow" style={{ padding: 16 }}>
            <h3 style={sectionTitle}>Submitted Incident Reports ({submittedReports.length})</h3>
            {renderReportList(submittedReports, "No submitted incident reports awaiting acknowledgement.")}
          </div>

          <div className="db-card db-card-green" style={{ padding: 16 }}>
            <h3 style={sectionTitle}>Resolved Incident Reports ({acknowledgedReports.length})</h3>
            {renderReportList(acknowledgedReports, "No resolved incident reports yet.")}
          </div>
        </div>
      ) : (
        <div className="db-card db-card-green" style={{ padding: 16 }}>
          <h3 style={sectionTitle}>Incident Reports ({reports.length})</h3>
          {renderReportList(reports, "No incident reports submitted yet.")}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <p style={labelText}>{label}</p>
      {children}
    </div>
  );
}

function BodyMap({ title, areas, selected, onToggle }: { title: string; areas: string[]; selected: string[]; onToggle: (area: string) => void }) {
  return (
    <div style={bodyMapBox}>
      <h4 style={bodyMapTitle}>{title}</h4>
      <div style={bodyShape}>
        <div style={headShape} />
        <div style={torsoShape} />
        <div style={limbRow}>
          <span style={limbShape} />
          <span style={limbShape} />
        </div>
      </div>

      <div style={areaGrid}>
        {areas.map((area) => (
          <label key={area} style={checkboxLine}>
            <input type="checkbox" checked={selected.includes(area)} onChange={() => onToggle(area)} />
            {area}
          </label>
        ))}
      </div>
    </div>
  );
}

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
} as const;

const sectionTitle = {
  margin: "0 0 12px",
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 800,
} as const;

const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
} as const;

const stack = {
  display: "grid",
  gap: 18,
} as const;

const summaryCard = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 9,
  minHeight: 58,
  border: "1px solid transparent",
  borderRadius: 13,
  padding: "9px 12px",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  transition: "transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease",
} as const;

const selectedSummaryCard = {
  borderColor: "currentColor",
  boxShadow: "0 4px 14px rgba(45, 42, 62, 0.12)",
  transform: "translateY(-1px)",
} as const;

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 9,
  marginBottom: 8,
} as const;

const summaryNumber = {
  fontSize: 24,
  lineHeight: 1,
  minWidth: 28,
} as const;

const summaryLabel = {
  fontSize: 13,
  lineHeight: 1.2,
  fontWeight: 800,
} as const;

const filterGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
} as const;

const compactSelect = {
  minHeight: 42,
  padding: "8px 12px",
  fontSize: 14,
} as const;

const bodyMapGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
  marginTop: 12,
} as const;

const labelText = {
  margin: "0 0 6px",
  color: "#6D6888",
  fontSize: 13,
  fontWeight: 800,
} as const;

const smallText = {
  margin: "4px 0 0",
  color: "#6D6888",
  fontSize: 13,
} as const;

const hiddenFileInput = {
  position: "absolute",
  inlineSize: 1,
  blockSize: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  clipPath: "inset(50%)",
} as const;

const uploadButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #CBEAF7",
  background: "#EAF7FD",
  color: "#2D2A3E",
  fontWeight: 800,
  cursor: "pointer",
} as const;

const checkboxLine = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#2D2A3E",
  fontSize: 14,
  fontWeight: 600,
} as const;

const bodyMapBox = {
  border: "1px solid #F0E3D8",
  borderRadius: 14,
  padding: 12,
  background: "#FFFDFB",
} as const;

const bodyMapTitle = {
  margin: "0 0 10px",
  color: "#2D2A3E",
  fontSize: 16,
  fontWeight: 800,
} as const;

const bodyShape = {
  display: "grid",
  justifyContent: "center",
  justifyItems: "center",
  gap: 5,
  marginBottom: 12,
} as const;

const headShape = {
  width: 34,
  height: 34,
  borderRadius: "999px",
  border: "2px solid #7CCCF3",
  background: "#EAF7FD",
} as const;

const torsoShape = {
  width: 70,
  height: 90,
  borderRadius: "24px 24px 12px 12px",
  border: "2px solid #7CCCF3",
  background: "#EAF7FD",
} as const;

const limbRow = {
  display: "flex",
  gap: 36,
} as const;

const limbShape = {
  display: "block",
  width: 20,
  height: 70,
  borderRadius: 999,
  border: "2px solid #7CCCF3",
  background: "#EAF7FD",
} as const;

const areaGrid = {
  display: "grid",
  gap: 8,
} as const;

const reportButton = {
  width: "100%",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 8,
  alignItems: "center",
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
  color: "#2D2A3E",
  cursor: "pointer",
  textAlign: "left",
} as const;

const reportDetail = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: 12,
  marginTop: 8,
} as const;

const detailText = {
  margin: "0 0 8px",
  color: "#5B5675",
  lineHeight: 1.5,
} as const;

const pillGreen = {
  border: "1px solid #BDE5C8",
  background: "#EEF9EE",
  color: "#276738",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 800,
} as const;

const pillAmber = {
  border: "1px solid #F3E4A3",
  background: "#FFF7D9",
  color: "#7A5A00",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 800,
} as const;

const photoGrid = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
} as const;

const photoLink = {
  color: "#2D2A3E",
  background: "#EAF7FD",
  border: "1px solid #CBEAF7",
  borderRadius: 12,
  padding: "8px 10px",
  textDecoration: "none",
  fontWeight: 700,
} as const;

const ackBox = {
  marginTop: 12,
  border: "1px solid #BDE5C8",
  borderRadius: 12,
  padding: 10,
  background: "#EEF9EE",
  color: "#2D2A3E",
} as const;
