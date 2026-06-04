"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentProfile } from "../../lib/auth";

type SponsorProgramme = {
  id: number;
  sponsor_name: string;
  programme_name: string;
  sponsor_type?: string | null;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  funding_focus?: string | null;
  reporting_cycle?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type SchoolRow = {
  id: number;
  school_name?: string | null;
  sponsor_programme_id?: number | null;
  sponsor_programmes?: SponsorProgramme | null;
};

type SchoolScopedRow = {
  school_id?: number | null;
  status?: string | null;
};

export default function ImpactSponsorshipDashboard() {
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [sponsors, setSponsors] = useState<SponsorProgramme[]>([]);
  const [learners, setLearners] = useState<SchoolScopedRow[]>([]);
  const [attendance, setAttendance] = useState<SchoolScopedRow[]>([]);
  const [summaries, setSummaries] = useState<SchoolScopedRow[]>([]);
  const [selectedSponsorProgrammeId, setSelectedSponsorProgrammeId] =
    useState("");

  const [programmeName, setProgrammeName] = useState("");
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorType, setSponsorType] = useState("CSI Partner");
  const [fundingFocus, setFundingFocus] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [savingSponsor, setSavingSponsor] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const { profile, error } = await getCurrentProfile();

    if (error || !profile) {
      router.push("/login");
      return;
    }

    if (profile?.role !== "master") {
      router.push("/dashboard");
      return;
    }

    setCheckingAccess(false);

    await Promise.all([
      fetchSponsors(),
      fetchSchools(),
      fetchLearners(),
      fetchAttendance(),
      fetchSummaries(),
    ]);
  }

  async function fetchSponsors() {
    const { data, error } = await supabase
      .from("sponsor_programmes")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setSponsors(data || []);
    }
  }

  async function fetchSchools() {
    const { data, error } = await supabase
      .from("schools")
      .select("*, sponsor_programmes(*)")
      .order("created_at", { ascending: false });

    if (!error) {
      setSchools(data || []);
    }
  }

  async function fetchLearners() {
    const { data, error } = await supabase.from("learners").select("*");

    if (!error) {
      setLearners(data || []);
    }
  }

  async function fetchAttendance() {
    const { data, error } = await supabase.from("attendance").select("*");

    if (!error) {
      setAttendance(data || []);
    }
  }

  async function fetchSummaries() {
    const { data, error } = await supabase.from("daily_summaries").select("*");

    if (!error) {
      setSummaries(data || []);
    }
  }

  async function createSponsorProgramme() {
    if (!sponsorName || !programmeName) {
      alert("Please add sponsor name and programme name.");
      return;
    }

    setSavingSponsor(true);

    const { error } = await supabase.from("sponsor_programmes").insert([
      {
        sponsor_name: sponsorName,
        programme_name: programmeName,
        sponsor_type: sponsorType,
        funding_focus: fundingFocus,
        contact_person: contactPerson,
        contact_email: contactEmail,
        reporting_cycle: "Quarterly",
        status: "Active",
      },
    ]);

    if (error) {
      alert(error.message);
      setSavingSponsor(false);
      return;
    }

    setSponsorName("");
    setProgrammeName("");
    setSponsorType("CSI Partner");
    setFundingFocus("");
    setContactPerson("");
    setContactEmail("");

    await fetchSponsors();
    setSavingSponsor(false);
    alert("Sponsor programme created.");
  }

  const sponsoredSchools = useMemo(() => {
    return schools.filter((school) => school.sponsor_programme_id !== null);
  }, [schools]);

  const schoolsForSponsor = useMemo(() => {
    if (!selectedSponsorProgrammeId) {
      return sponsoredSchools;
    }

    return schools.filter(
      (school) =>
        String(school.sponsor_programme_id) ===
        String(selectedSponsorProgrammeId)
    );
  }, [schools, sponsoredSchools, selectedSponsorProgrammeId]);

  const sponsoredSchoolIds = useMemo(
    () => schoolsForSponsor.map((school) => school.id),
    [schoolsForSponsor]
  );

  const learnersSupported = learners.filter((learner) =>
    sponsoredSchoolIds.includes(Number(learner.school_id))
  );

  const attendanceRecords = attendance.filter((record) =>
    sponsoredSchoolIds.includes(Number(record.school_id))
  );

  const progressReportsGenerated = summaries.filter((summary) =>
    sponsoredSchoolIds.includes(Number(summary.school_id))
  );

  const attendanceRate =
    attendanceRecords.length === 0
      ? 0
      : Math.round(
          (attendanceRecords.filter((item) => item.status === "present")
            .length /
            attendanceRecords.length) *
            100
        );

  if (checkingAccess) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <div
        className="db-soft-card"
        style={{ padding: "22px", marginBottom: "24px" }}
      >
        <h1 className="db-page-title">Impact & Sponsorship Dashboard</h1>
        <p className="db-page-subtitle">
          Track sponsored school reach, learner support, training progress,
          attendance trends, parent engagement and quarterly sponsor reporting.
        </p>
      </div>

      <div className="db-grid-4" style={{ marginBottom: "24px" }}>
        <Metric title="Sponsor Programmes" value={sponsors.length} />
        <Metric title="Sponsored Schools" value={schoolsForSponsor.length} />
        <Metric title="Learners Supported" value={learnersSupported.length} />
        <Metric title="Attendance Rate" value={`${attendanceRate}%`} />
      </div>

      <div
        className="db-card db-card-blue"
        style={{ padding: "20px", marginBottom: "24px" }}
      >
        <h2 style={sectionTitle}>Overview</h2>
        <p style={textStyle}>
          This view is designed for internal reporting to sponsors, CSI
          partners, foundations and government departments. It shows which
          schools are funded, how many learners are reached and what operational
          support DailyBloom is helping schools deliver.
        </p>

        <select
          className="db-input"
          value={selectedSponsorProgrammeId}
          onChange={(event) =>
            setSelectedSponsorProgrammeId(event.target.value)
          }
        >
          <option value="">All sponsor programmes</option>
          {sponsors.map((sponsor) => (
            <option key={sponsor.id} value={sponsor.id}>
              {sponsor.sponsor_name} - {sponsor.programme_name}
            </option>
          ))}
        </select>
      </div>

      <div className="db-grid-2" style={{ marginBottom: "24px" }}>
        <div className="db-card db-card-green" style={{ padding: "20px" }}>
          <h2 style={sectionTitle}>Create Sponsor Programme</h2>

          <input
            className="db-input"
            placeholder="Sponsor name"
            value={sponsorName}
            onChange={(event) => setSponsorName(event.target.value)}
          />

          <input
            className="db-input"
            placeholder="Programme name"
            value={programmeName}
            onChange={(event) => setProgrammeName(event.target.value)}
          />

          <select
            className="db-input"
            value={sponsorType}
            onChange={(event) => setSponsorType(event.target.value)}
          >
            <option>CSI Partner</option>
            <option>Foundation</option>
            <option>Government Department</option>
            <option>Corporate Sponsor</option>
            <option>NGO Partner</option>
          </select>

          <input
            className="db-input"
            placeholder="Funding focus, for example ECD admin support"
            value={fundingFocus}
            onChange={(event) => setFundingFocus(event.target.value)}
          />

          <input
            className="db-input"
            placeholder="Contact person"
            value={contactPerson}
            onChange={(event) => setContactPerson(event.target.value)}
          />

          <input
            className="db-input"
            placeholder="Contact email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
          />

          <button
            className="db-button-primary"
            style={{ width: "100%" }}
            onClick={createSponsorProgramme}
            disabled={savingSponsor}
          >
            {savingSponsor ? "Saving..." : "Create Sponsor Programme"}
          </button>
        </div>

        <div className="db-card db-card-lavender" style={{ padding: "20px" }}>
          <h2 style={sectionTitle}>Quarterly Report Summary</h2>

          <ReportLine label="Schools onboarded" value={schoolsForSponsor.length} />
          <ReportLine label="Learners supported" value={learnersSupported.length} />
          <ReportLine
            label="Attendance records captured"
            value={attendanceRecords.length}
          />
          <ReportLine
            label="Progress reports generated"
            value={progressReportsGenerated.length}
          />
          <ReportLine label="Reporting cycle" value="Quarterly" />

          <p style={{ ...textStyle, marginTop: "16px" }}>
            Use this section to prepare manual sponsor updates and
            government-ready summaries showing reach, usage and school-level
            impact.
          </p>
        </div>
      </div>

      <div
        className="db-card db-card-yellow"
        style={{ padding: "20px", marginBottom: "24px" }}
      >
        <h2 style={sectionTitle}>Sponsor Programmes</h2>

        {sponsors.length === 0 ? (
          <p className="db-helper">No sponsor programmes created yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {sponsors.map((sponsor) => (
              <div key={sponsor.id} className="db-list-card">
                <strong>{sponsor.sponsor_name}</strong>
                <p style={textStyle}>Programme: {sponsor.programme_name}</p>
                <p style={textStyle}>
                  Type: {sponsor.sponsor_type || "Not set"}
                </p>
                <p style={textStyle}>
                  Focus: {sponsor.funding_focus || "Not set"}
                </p>
                <p style={textStyle}>
                  Reporting: {sponsor.reporting_cycle || "Quarterly"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="db-card db-card-blue"
        style={{ padding: "20px", marginBottom: "24px" }}
      >
        <h2 style={sectionTitle}>Sponsored Schools</h2>

        {schoolsForSponsor.length === 0 ? (
          <p className="db-helper">No sponsored schools linked yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {schoolsForSponsor.map((school) => (
              <div key={school.id} className="db-list-card">
                <strong>{school.school_name}</strong>
                <p style={textStyle}>
                  Sponsor: {school.sponsor_programmes?.sponsor_name || "Not linked"}
                </p>
                <p style={textStyle}>
                  Programme:{" "}
                  {school.sponsor_programmes?.programme_name || "Not linked"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="db-grid-2">
        <div className="db-card db-card-green" style={{ padding: "20px" }}>
          <h2 style={sectionTitle}>Training Records</h2>
          <p style={textStyle}>
            Track principal and educator onboarding, DailyBloom usage support,
            report generation training and parent communication readiness.
          </p>
        </div>

        <div className="db-card db-card-lavender" style={{ padding: "20px" }}>
          <h2 style={sectionTitle}>Success Stories</h2>
          <p style={textStyle}>
            Capture school stories, before-and-after admin improvements, parent
            communication wins and learner support outcomes.
          </p>
        </div>
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="db-card db-card-white" style={{ padding: "18px" }}>
      <p style={{ margin: 0, color: "var(--db-text-soft)", fontSize: "13px" }}>
        {title}
      </p>
      <h2
        style={{
          margin: "8px 0 0",
          fontSize: "30px",
          color: "var(--db-text)",
        }}
      >
        {value}
      </h2>
    </div>
  );
}

function ReportLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        borderBottom: "1px solid #eee",
        padding: "10px 0",
      }}
    >
      <span style={{ color: "var(--db-text-soft)" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const sectionTitle = {
  marginTop: 0,
  marginBottom: "14px",
  color: "var(--db-text)",
  fontSize: "22px",
  fontWeight: 800 as const,
};

const textStyle = {
  margin: "6px 0 0 0",
  color: "var(--db-text-soft)",
  lineHeight: 1.6,
};
