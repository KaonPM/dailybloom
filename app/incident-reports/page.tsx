"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { resolveSchoolContext } from "../lib/school-context";

type Learner = {
  id: string;
  name?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  classroom_id?: number | null;
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
  created_at?: string | null;
};

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
  const [profile, setProfile] = useState<any>(null);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState("");

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
  const [frontInjuries, setFrontInjuries] = useState<string[]>([]);
  const [backInjuries, setBackInjuries] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);

  const selectedLearner = useMemo(
    () => learners.find((item) => String(item.id) === String(learnerId)) || null,
    [learners, learnerId]
  );

  const canCreate = profile?.role === "teacher" || profile?.role === "principal" || profile?.role === "master";
  const canAcknowledge = profile?.role === "principal" || profile?.role === "master";
  const submittedReports = reports.filter((report) => report.status !== "acknowledged");
  const acknowledgedReports = reports.filter((report) => report.status === "acknowledged");

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
    const files = Array.from(event.target.files || []).slice(0, 2);
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

      const { data } = supabase.storage
        .from("incident-report-photos")
        .getPublicUrl(path);

      if (data.publicUrl) {
        urls.push(data.publicUrl);
      }
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

    try {
      const photoUrls = await uploadPhotos(schoolId);
      const principalCreatedReport = canAcknowledge;
      const classroom = Array.isArray((selectedLearner as any).classrooms)
        ? (selectedLearner as any).classrooms[0]
        : (selectedLearner as any).classrooms;

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
          parent_notified: parentNotified,
          parent_notified_at: parentNotifiedAt || null,
          witness_name: witnessName.trim() || null,
          front_injury_areas: frontInjuries,
          back_injury_areas: backInjuries,
          photo_urls: photoUrls,
          status: principalCreatedReport ? "acknowledged" : "submitted",
          principal_acknowledged_at: principalCreatedReport ? new Date().toISOString() : null,
          principal_acknowledged_by: principalCreatedReport ? profile.full_name || profile.id : null,
        },
      ]);

      if (error) {
        throw error;
      }

      resetForm();
      setShowForm(false);
      setSelectedReport(null);
      await fetchReports(schoolId);
      alert(principalCreatedReport ? "Incident report acknowledged and saved." : "Incident report submitted to principal.");
    } catch (error: any) {
      alert(error?.message || "Could not submit incident report.");
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
        status: "acknowledged",
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
    alert("Incident report acknowledged.");
  }

  function renderReportList(list: IncidentReport[], emptyText: string) {
    if (list.length === 0) {
      return <p className="db-helper">{emptyText}</p>;
    }

    return (
      <div style={{ display: "grid", gap: 10 }}>
        {list.map((report) => {
          const active = selectedReport?.id === report.id;
          const acknowledged = report.status === "acknowledged";

          return (
            <div key={report.id}>
              <button type="button" onClick={() => setSelectedReport(active ? null : report)} style={reportButton}>
                <strong>{report.learner_name || "Learner"} - {report.incident_type || "Incident"}</strong>
                <span style={acknowledged ? pillGreen : pillAmber}>
                  {acknowledged ? "Acknowledged" : "Submitted"}
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
                  <p style={detailText}><strong>First aid:</strong> {report.first_aid_given || "Not set"}</p>
                  <p style={detailText}><strong>Action taken:</strong> {report.action_taken || "Not set"}</p>
                  <p style={detailText}><strong>Parent notified:</strong> {report.parent_notified ? "Yes" : "No"}</p>
                  <p style={detailText}><strong>Witness:</strong> {report.witness_name || "Not set"}</p>
                  <p style={detailText}><strong>Front injuries:</strong> {(report.front_injury_areas || []).join(", ") || "None marked"}</p>
                  <p style={detailText}><strong>Back injuries:</strong> {(report.back_injury_areas || []).join(", ") || "None marked"}</p>

                  {(report.photo_urls || []).length > 0 ? (
                    <div style={photoGrid}>
                      {(report.photo_urls || []).map((url) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={photoLink}>
                          View photo
                        </a>
                      ))}
                    </div>
                  ) : null}

                  {acknowledged ? (
                    <div style={ackBox}>
                      <strong>Acknowledged by {report.principal_acknowledged_by || "principal"}</strong>
                      <p style={smallText}>{report.principal_notes || "No principal notes added."}</p>
                    </div>
                  ) : canAcknowledge ? (
                    <div style={{ marginTop: 12 }}>
                      <textarea className="db-input" rows={3} value={acknowledgeNotes} onChange={(event) => setAcknowledgeNotes(event.target.value)} placeholder="Principal notes..." style={{ resize: "vertical" }} />
                      <button type="button" className="db-button-primary" style={{ marginTop: 10 }} onClick={() => acknowledgeReport(report)} disabled={acknowledgingId === report.id}>
                        {acknowledgingId === report.id ? "Acknowledging..." : "Acknowledge Report"}
                      </button>
                    </div>
                  ) : null}
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
              <input className="db-input" value={incidentType} onChange={(event) => setIncidentType(event.target.value)} placeholder="Fall, cut, bump, bite..." />
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
          </Field>

          <div style={grid2}>
            <Field label="First Aid Given">
              <textarea className="db-input" rows={3} value={firstAidGiven} onChange={(event) => setFirstAidGiven(event.target.value)} style={{ resize: "vertical" }} />
            </Field>

            <Field label="Action Taken / Follow Up">
              <textarea className="db-input" rows={3} value={actionTaken} onChange={(event) => setActionTaken(event.target.value)} style={{ resize: "vertical" }} />
            </Field>
          </div>

          <div style={grid2}>
            <label style={checkboxLine}>
              <input type="checkbox" checked={parentNotified} onChange={(event) => setParentNotified(event.target.checked)} />
              Parent notified
            </label>

            <Field label="Parent Notified At">
              <input className="db-input" type="datetime-local" value={parentNotifiedAt} onChange={(event) => setParentNotifiedAt(event.target.value)} />
            </Field>
          </div>

          <Field label="Witness Name">
            <input className="db-input" value={witnessName} onChange={(event) => setWitnessName(event.target.value)} />
          </Field>

          <div style={bodyMapGrid}>
            <BodyMap title="Front Body Map" areas={frontAreas} selected={frontInjuries} onToggle={(area) => toggleArea(area, "front")} />
            <BodyMap title="Back Body Map" areas={backAreas} selected={backInjuries} onToggle={(area) => toggleArea(area, "back")} />
          </div>

          <Field label="Photos (up to 2)">
            <input id="incident-photos" style={hiddenFileInput} type="file" accept="image/*" multiple onChange={handlePhotosChange} />
            <label htmlFor="incident-photos" style={uploadButton}>
              Upload Photos
            </label>
            <p style={smallText}>{photos.length} selected. Only the first 2 images will be saved.</p>
          </Field>

          <button type="button" className="db-button-primary" style={{ width: "100%", marginTop: 12 }} onClick={submitIncidentReport} disabled={saving}>
            {saving ? (canAcknowledge ? "Saving..." : "Submitting...") : (canAcknowledge ? "Acknowledge Incident Report" : "Submit to Principal")}
          </button>
        </div>
      ) : null}

      {canAcknowledge ? (
        <div style={stack}>
          <div className="db-card db-card-yellow" style={{ padding: 16 }}>
            <h3 style={sectionTitle}>Submitted Incident Reports ({submittedReports.length})</h3>
            {renderReportList(submittedReports, "No submitted incident reports awaiting acknowledgement.")}
          </div>

          <div className="db-card db-card-green" style={{ padding: 16 }}>
            <h3 style={sectionTitle}>Acknowledged Incident Reports ({acknowledgedReports.length})</h3>
            {renderReportList(acknowledgedReports, "No acknowledged incident reports yet.")}
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
