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

type MaybeSponsorProgrammeRelation =
  | SponsorProgramme
  | SponsorProgramme[]
  | null
  | undefined;

type SchoolRow = {
  id: number;
  school_name?: string | null;
  sponsor_programme_id?: number | null;
  sponsor_programmes?: SponsorProgramme | null;
};

type SchoolScopedRow = {
  school_id?: number | null;
  status?: string | null;
  date?: string | null;
  attendance_date?: string | null;
  summary_date?: string | null;
  created_at?: string | null;
};

type SchoolRelation =
  | {
      school_name?: string | null;
    }
  | {
      school_name?: string | null;
    }[]
  | null
  | undefined;

type TrainingRecord = {
  id: number;
  sponsor_programme_id?: number | null;
  school_id: number;
  training_date: string;
  training_type: string;
  attendees_count?: number | null;
  notes?: string | null;
  created_at?: string | null;
  schools?: {
    school_name?: string | null;
  } | null;
};

type SuccessStory = {
  id: number;
  sponsor_programme_id?: number | null;
  school_id: number;
  story_date: string;
  title: string;
  summary?: string | null;
  outcome?: string | null;
  created_at?: string | null;
  schools?: {
    school_name?: string | null;
  } | null;
};

type GeneratedReport = {
  sponsorProgramme: string;
  schoolScope: string;
  reportingPeriod: string;
  schoolsSupported: number;
  learnersSupported: number;
  attendanceRecords: number;
  attendanceRate: number;
  progressReportsGenerated: number;
  trainingSessions: number;
  trainingAttendees: number;
  successStories: number;
};

const periodTypes = ["Month", "Quarter", "Semester", "Annual"];
const monthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const quarterOptions = ["Q1", "Q2", "Q3", "Q4"];
const semesterOptions = ["Semester 1", "Semester 2"];

function normalizeSponsorProgramme(
  sponsorProgrammes: MaybeSponsorProgrammeRelation
) {
  return Array.isArray(sponsorProgrammes)
    ? sponsorProgrammes[0] || null
    : sponsorProgrammes || null;
}

function normalizeSchoolRelation(schools: SchoolRelation) {
  return Array.isArray(schools) ? schools[0] || null : schools || null;
}

function getCurrentQuarter() {
  return `Q${Math.floor(new Date().getMonth() / 3) + 1}`;
}

function getRecordDate(record: SchoolScopedRow) {
  return (
    record.date ||
    record.attendance_date ||
    record.summary_date ||
    record.created_at ||
    null
  );
}

function isInSelectedPeriod({
  dateValue,
  periodType,
  month,
  quarter,
  semester,
  year,
}: {
  dateValue: string | null | undefined;
  periodType: string;
  month: string;
  quarter: string;
  semester: string;
  year: string;
}) {
  if (!dateValue) return true;

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return true;

  if (date.getFullYear() !== Number(year)) return false;

  if (periodType === "Annual") return true;

  if (periodType === "Month") {
    return date.getMonth() === Number(month);
  }

  if (periodType === "Quarter") {
    const quarterNumber = Number(quarter.replace("Q", ""));
    const startMonth = (quarterNumber - 1) * 3;

    return date.getMonth() >= startMonth && date.getMonth() < startMonth + 3;
  }

  if (periodType === "Semester") {
    if (semester === "Semester 1") {
      return date.getMonth() >= 0 && date.getMonth() <= 5;
    }

    return date.getMonth() >= 6 && date.getMonth() <= 11;
  }

  return true;
}

export default function ImpactSponsorshipDashboard() {
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [sponsors, setSponsors] = useState<SponsorProgramme[]>([]);
  const [learners, setLearners] = useState<SchoolScopedRow[]>([]);
  const [attendance, setAttendance] = useState<SchoolScopedRow[]>([]);
  const [summaries, setSummaries] = useState<SchoolScopedRow[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [successStories, setSuccessStories] = useState<SuccessStory[]>([]);

  const [selectedSponsorProgrammeId, setSelectedSponsorProgrammeId] =
    useState("");
  const [showSponsorForm, setShowSponsorForm] = useState(false);

  const [programmeName, setProgrammeName] = useState("");
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorType, setSponsorType] = useState("CSI Partner");
  const [fundingFocus, setFundingFocus] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [savingSponsor, setSavingSponsor] = useState(false);

  const [reportSponsorProgrammeId, setReportSponsorProgrammeId] = useState("");
  const [reportSchoolId, setReportSchoolId] = useState("");
  const [reportPeriodType, setReportPeriodType] = useState("Quarter");
  const [reportMonth, setReportMonth] = useState(String(new Date().getMonth()));
  const [reportQuarter, setReportQuarter] = useState(getCurrentQuarter());
  const [reportSemester, setReportSemester] = useState("Semester 1");
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [generatedReport, setGeneratedReport] =
    useState<GeneratedReport | null>(null);

  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [trainingSchoolId, setTrainingSchoolId] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [trainingType, setTrainingType] = useState("");
  const [trainingAttendees, setTrainingAttendees] = useState("");
  const [trainingNotes, setTrainingNotes] = useState("");
  const [savingTraining, setSavingTraining] = useState(false);

  const [showStoryForm, setShowStoryForm] = useState(false);
  const [storySchoolId, setStorySchoolId] = useState("");
  const [storyDate, setStoryDate] = useState("");
  const [storyTitle, setStoryTitle] = useState("");
  const [storySummary, setStorySummary] = useState("");
  const [storyOutcome, setStoryOutcome] = useState("");
  const [savingStory, setSavingStory] = useState(false);

  const [sponsorPage, setSponsorPage] = useState(0);
  const [schoolPage, setSchoolPage] = useState(0);

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
      fetchTrainingRecords(),
      fetchSuccessStories(),
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
      const rows = (data || []).map((school: any) => ({
        ...school,
        sponsor_programmes: normalizeSponsorProgramme(
          school.sponsor_programmes
        ),
      })) as SchoolRow[];

      setSchools(rows);
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

  async function fetchTrainingRecords() {
    const { data, error } = await supabase
      .from("impact_training_records")
      .select("*, schools(school_name)")
      .order("training_date", { ascending: false });

    if (!error) {
      const rows = (data || []).map((record: any) => ({
        ...record,
        schools: normalizeSchoolRelation(record.schools),
      })) as TrainingRecord[];

      setTrainingRecords(rows);
    }
  }

  async function fetchSuccessStories() {
    const { data, error } = await supabase
      .from("impact_success_stories")
      .select("*, schools(school_name)")
      .order("story_date", { ascending: false });

    if (!error) {
      const rows = (data || []).map((story: any) => ({
        ...story,
        schools: normalizeSchoolRelation(story.schools),
      })) as SuccessStory[];

      setSuccessStories(rows);
    }
  }

  async function createSponsorProgramme() {
    if (!sponsorName.trim() || !programmeName.trim()) {
      alert("Please add sponsor name and programme name.");
      return;
    }

    setSavingSponsor(true);

    const { error } = await supabase.from("sponsor_programmes").insert([
      {
        sponsor_name: sponsorName.trim(),
        programme_name: programmeName.trim(),
        sponsor_type: sponsorType,
        funding_focus: fundingFocus.trim() || null,
        contact_person: contactPerson.trim() || null,
        contact_email: contactEmail.trim() || null,
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
    setShowSponsorForm(false);
    alert("Sponsor programme created.");
  }

  async function createTrainingRecord() {
    if (!trainingSchoolId || !trainingDate || !trainingType.trim()) {
      alert("Please add school, date and training type.");
      return;
    }

    const selectedSchool = schools.find(
      (school) => String(school.id) === String(trainingSchoolId)
    );

    setSavingTraining(true);

    const { error } = await supabase.from("impact_training_records").insert([
      {
        school_id: Number(trainingSchoolId),
        sponsor_programme_id: selectedSchool?.sponsor_programme_id || null,
        training_date: trainingDate,
        training_type: trainingType.trim(),
        attendees_count: trainingAttendees ? Number(trainingAttendees) : 0,
        notes: trainingNotes.trim() || null,
      },
    ]);

    if (error) {
      alert(error.message);
      setSavingTraining(false);
      return;
    }

    setTrainingSchoolId("");
    setTrainingDate("");
    setTrainingType("");
    setTrainingAttendees("");
    setTrainingNotes("");

    await fetchTrainingRecords();

    setSavingTraining(false);
    setShowTrainingForm(false);
    alert("Training record saved.");
  }

  async function createSuccessStory() {
    if (!storySchoolId || !storyDate || !storyTitle.trim()) {
      alert("Please add school, date and story title.");
      return;
    }

    const selectedSchool = schools.find(
      (school) => String(school.id) === String(storySchoolId)
    );

    setSavingStory(true);

    const { error } = await supabase.from("impact_success_stories").insert([
      {
        school_id: Number(storySchoolId),
        sponsor_programme_id: selectedSchool?.sponsor_programme_id || null,
        story_date: storyDate,
        title: storyTitle.trim(),
        summary: storySummary.trim() || null,
        outcome: storyOutcome.trim() || null,
      },
    ]);

    if (error) {
      alert(error.message);
      setSavingStory(false);
      return;
    }

    setStorySchoolId("");
    setStoryDate("");
    setStoryTitle("");
    setStorySummary("");
    setStoryOutcome("");

    await fetchSuccessStories();

    setSavingStory(false);
    setShowStoryForm(false);
    alert("Success story saved.");
  }

  const sponsoredSchools = useMemo(() => {
    return schools.filter((school) => school.sponsor_programme_id);
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

  const reportSchools = useMemo(() => {
    const sponsorScopedSchools = reportSponsorProgrammeId
      ? schools.filter(
          (school) =>
            String(school.sponsor_programme_id) ===
            String(reportSponsorProgrammeId)
        )
      : sponsoredSchools;

    if (!reportSchoolId) {
      return sponsorScopedSchools;
    }

    return sponsorScopedSchools.filter(
      (school) => String(school.id) === String(reportSchoolId)
    );
  }, [schools, sponsoredSchools, reportSponsorProgrammeId, reportSchoolId]);

  const sponsoredSchoolIds = useMemo(
    () => schoolsForSponsor.map((school) => school.id),
    [schoolsForSponsor]
  );

  const reportSchoolIds = useMemo(
    () => reportSchools.map((school) => school.id),
    [reportSchools]
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

  const trainingRecordsForSponsor = trainingRecords.filter((record) =>
    sponsoredSchoolIds.includes(Number(record.school_id))
  );

  const successStoriesForSponsor = successStories.filter((story) =>
    sponsoredSchoolIds.includes(Number(story.school_id))
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

  const visibleSponsors = sponsors.slice(sponsorPage * 5, sponsorPage * 5 + 5);
  const visibleSponsoredSchools = schoolsForSponsor.slice(
    schoolPage * 5,
    schoolPage * 5 + 5
  );

  function getReportingPeriodLabel() {
    if (reportPeriodType === "Month") {
      return `${monthOptions[Number(reportMonth)]} ${reportYear}`;
    }

    if (reportPeriodType === "Quarter") {
      return `${reportQuarter} ${reportYear}`;
    }

    if (reportPeriodType === "Semester") {
      return `${reportSemester} ${reportYear}`;
    }

    return `Annual ${reportYear}`;
  }

  function generateReport() {
    const reportLearners = learners.filter((learner) =>
      reportSchoolIds.includes(Number(learner.school_id))
    );

    const reportAttendance = attendance.filter(
      (record) =>
        reportSchoolIds.includes(Number(record.school_id)) &&
        isInSelectedPeriod({
          dateValue: getRecordDate(record),
          periodType: reportPeriodType,
          month: reportMonth,
          quarter: reportQuarter,
          semester: reportSemester,
          year: reportYear,
        })
    );

    const presentAttendance = reportAttendance.filter(
      (record) => record.status === "present"
    ).length;

    const reportSummaries = summaries.filter(
      (summary) =>
        reportSchoolIds.includes(Number(summary.school_id)) &&
        isInSelectedPeriod({
          dateValue: getRecordDate(summary),
          periodType: reportPeriodType,
          month: reportMonth,
          quarter: reportQuarter,
          semester: reportSemester,
          year: reportYear,
        })
    );

    const reportTraining = trainingRecords.filter(
      (record) =>
        reportSchoolIds.includes(Number(record.school_id)) &&
        isInSelectedPeriod({
          dateValue: record.training_date,
          periodType: reportPeriodType,
          month: reportMonth,
          quarter: reportQuarter,
          semester: reportSemester,
          year: reportYear,
        })
    );

    const reportStories = successStories.filter(
      (story) =>
        reportSchoolIds.includes(Number(story.school_id)) &&
        isInSelectedPeriod({
          dateValue: story.story_date,
          periodType: reportPeriodType,
          month: reportMonth,
          quarter: reportQuarter,
          semester: reportSemester,
          year: reportYear,
        })
    );

    const selectedSponsor = sponsors.find(
      (sponsor) => String(sponsor.id) === String(reportSponsorProgrammeId)
    );

    const selectedSchool = schools.find(
      (school) => String(school.id) === String(reportSchoolId)
    );

    setGeneratedReport({
      sponsorProgramme: selectedSponsor
        ? `${selectedSponsor.sponsor_name} - ${selectedSponsor.programme_name}`
        : "All sponsor programmes",
      schoolScope: selectedSchool
        ? selectedSchool.school_name || "Selected school"
        : "All sponsored schools",
      reportingPeriod: getReportingPeriodLabel(),
      schoolsSupported: reportSchools.length,
      learnersSupported: reportLearners.length,
      attendanceRecords: reportAttendance.length,
      attendanceRate:
        reportAttendance.length === 0
          ? 0
          : Math.round((presentAttendance / reportAttendance.length) * 100),
      progressReportsGenerated: reportSummaries.length,
      trainingSessions: reportTraining.length,
      trainingAttendees: reportTraining.reduce(
        (total, record) => total + Number(record.attendees_count || 0),
        0
      ),
      successStories: reportStories.length,
    });
  }

  function getReportRows() {
    if (!generatedReport) return [];

    return [
      ["Sponsor Programme", generatedReport.sponsorProgramme],
      ["School Scope", generatedReport.schoolScope],
      ["Reporting Period", generatedReport.reportingPeriod],
      ["Schools Supported", generatedReport.schoolsSupported],
      ["Learners Supported", generatedReport.learnersSupported],
      ["Attendance Records", generatedReport.attendanceRecords],
      ["Attendance Rate", `${generatedReport.attendanceRate}%`],
      ["Progress Reports Generated", generatedReport.progressReportsGenerated],
      ["Training Sessions", generatedReport.trainingSessions],
      ["Training Attendees", generatedReport.trainingAttendees],
      ["Success Stories", generatedReport.successStories],
    ];
  }

  function exportExcel() {
    if (!generatedReport) {
      alert("Please generate a report first.");
      return;
    }

    const rows = getReportRows();
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `dailybloom-impact-report-${generatedReport.reportingPeriod.replaceAll(
      " ",
      "-"
    )}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    if (!generatedReport) {
      alert("Please generate a report first.");
      return;
    }

    window.print();
  }

  if (checkingAccess) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <div
        className="db-soft-card"
        style={{
          padding: "22px",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 className="db-page-title">Impact & Sponsorship Dashboard</h1>
          <p className="db-page-subtitle">
            Pull sponsor-ready reports, track sponsored schools, capture
            training records and record success stories.
          </p>
        </div>

        <button
          className="db-button-primary"
          onClick={() => setShowSponsorForm((current) => !current)}
        >
          {showSponsorForm ? "Close Sponsor Form" : "+ Create Sponsor Programme"}
        </button>
      </div>

      {showSponsorForm && (
        <div
          className="db-card db-card-green"
          style={{ padding: "20px", marginBottom: "24px" }}
        >
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
            {savingSponsor ? "Saving..." : "Save Sponsor Programme"}
          </button>
        </div>
      )}

      <div className="db-grid-4" style={{ marginBottom: "24px" }}>
        <Metric title="Sponsor Programmes" value={sponsors.length} />
        <Metric title="Sponsored Schools" value={schoolsForSponsor.length} />
        <Metric title="Learners Supported" value={learnersSupported.length} />
        <Metric title="Attendance Rate" value={`${attendanceRate}%`} />
      </div>

      <div
        className="db-card db-card-lavender"
        style={{ padding: "20px", marginBottom: "24px" }}
      >
        <h2 style={sectionTitle}>Report Summary</h2>

        <div className="db-grid-2">
          <select
            className="db-input"
            value={reportSponsorProgrammeId}
            onChange={(event) => {
              setReportSponsorProgrammeId(event.target.value);
              setReportSchoolId("");
              setGeneratedReport(null);
            }}
          >
            <option value="">All sponsor programmes</option>
            {sponsors.map((sponsor) => (
              <option key={sponsor.id} value={sponsor.id}>
                {sponsor.sponsor_name} - {sponsor.programme_name}
              </option>
            ))}
          </select>

          <select
            className="db-input"
            value={reportSchoolId}
            onChange={(event) => {
              setReportSchoolId(event.target.value);
              setGeneratedReport(null);
            }}
          >
            <option value="">All sponsored schools</option>
            {reportSchools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.school_name || "Unnamed school"}
              </option>
            ))}
          </select>
        </div>

        <div className="db-grid-4" style={{ marginBottom: "12px" }}>
          <select
            className="db-input"
            value={reportPeriodType}
            onChange={(event) => {
              setReportPeriodType(event.target.value);
              setGeneratedReport(null);
            }}
          >
            {periodTypes.map((period) => (
              <option key={period} value={period}>
                {period}
              </option>
            ))}
          </select>

          {reportPeriodType === "Month" && (
            <select
              className="db-input"
              value={reportMonth}
              onChange={(event) => {
                setReportMonth(event.target.value);
                setGeneratedReport(null);
              }}
            >
              {monthOptions.map((month, index) => (
                <option key={month} value={index}>
                  {month}
                </option>
              ))}
            </select>
          )}

          {reportPeriodType === "Quarter" && (
            <select
              className="db-input"
              value={reportQuarter}
              onChange={(event) => {
                setReportQuarter(event.target.value);
                setGeneratedReport(null);
              }}
            >
              {quarterOptions.map((quarter) => (
                <option key={quarter} value={quarter}>
                  {quarter}
                </option>
              ))}
            </select>
          )}

          {reportPeriodType === "Semester" && (
            <select
              className="db-input"
              value={reportSemester}
              onChange={(event) => {
                setReportSemester(event.target.value);
                setGeneratedReport(null);
              }}
            >
              {semesterOptions.map((semester) => (
                <option key={semester} value={semester}>
                  {semester}
                </option>
              ))}
            </select>
          )}

          <input
            className="db-input"
            placeholder="Year"
            value={reportYear}
            onChange={(event) => {
              setReportYear(event.target.value);
              setGeneratedReport(null);
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="db-button-primary" onClick={generateReport}>
            Generate Report
          </button>

          <button style={secondaryButton} onClick={exportPdf}>
            Export PDF
          </button>

          <button style={secondaryButton} onClick={exportExcel}>
            Export Excel
          </button>
        </div>

        {generatedReport && (
          <div className="db-list-card" style={{ marginTop: "16px" }}>
            <h3 style={{ ...sectionTitle, fontSize: "18px" }}>
              Generated Impact Report
            </h3>

            {getReportRows().map(([label, value]) => (
              <ReportLine key={label} label={String(label)} value={value} />
            ))}

            <p style={{ ...textStyle, marginTop: "16px" }}>
              During this period, DailyBloom supported{" "}
              {generatedReport.schoolsSupported} sponsored school(s), reaching{" "}
              {generatedReport.learnersSupported} learner(s), capturing{" "}
              {generatedReport.attendanceRecords} attendance record(s), and
              generating {generatedReport.progressReportsGenerated} progress
              report record(s). The report also includes{" "}
              {generatedReport.trainingSessions} training session(s) and{" "}
              {generatedReport.successStories} success story record(s).
            </p>
          </div>
        )}
      </div>

      <div
        className="db-card db-card-yellow"
        style={{ padding: "20px", marginBottom: "24px" }}
      >
        <h2 style={sectionTitle}>Sponsor Programmes</h2>

        {sponsors.length === 0 ? (
          <p className="db-helper">No sponsor programmes created yet.</p>
        ) : (
          <>
            <div style={{ display: "grid", gap: "12px" }}>
              {visibleSponsors.map((sponsor) => (
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

            <PaginationButtons
              currentPage={sponsorPage}
              totalItems={sponsors.length}
              onPrevious={() => setSponsorPage((current) => current - 1)}
              onNext={() => setSponsorPage((current) => current + 1)}
            />
          </>
        )}
      </div>

      <div
        className="db-card db-card-blue"
        style={{ padding: "20px", marginBottom: "24px" }}
      >
        <h2 style={sectionTitle}>Sponsored Schools</h2>

        <select
          className="db-input"
          value={selectedSponsorProgrammeId}
          onChange={(event) => {
            setSelectedSponsorProgrammeId(event.target.value);
            setSchoolPage(0);
          }}
        >
          <option value="">All sponsor programmes</option>
          {sponsors.map((sponsor) => (
            <option key={sponsor.id} value={sponsor.id}>
              {sponsor.sponsor_name} - {sponsor.programme_name}
            </option>
          ))}
        </select>

        {schoolsForSponsor.length === 0 ? (
          <p className="db-helper">No sponsored schools linked yet.</p>
        ) : (
          <>
            <div style={{ display: "grid", gap: "12px" }}>
              {visibleSponsoredSchools.map((school) => (
                <div key={school.id} className="db-list-card">
                  <strong>{school.school_name}</strong>
                  <p style={textStyle}>
                    Sponsor:{" "}
                    {school.sponsor_programmes?.sponsor_name || "Not linked"}
                  </p>
                  <p style={textStyle}>
                    Programme:{" "}
                    {school.sponsor_programmes?.programme_name || "Not linked"}
                  </p>
                </div>
              ))}
            </div>

            <PaginationButtons
              currentPage={schoolPage}
              totalItems={schoolsForSponsor.length}
              onPrevious={() => setSchoolPage((current) => current - 1)}
              onNext={() => setSchoolPage((current) => current + 1)}
            />
          </>
        )}
      </div>

      <div className="db-grid-2">
        <div className="db-card db-card-green" style={{ padding: "20px" }}>
          <h2 style={sectionTitle}>Training Records</h2>
          <p style={textStyle}>
            Track principal and educator onboarding, DailyBloom usage support,
            report generation training and parent communication readiness.
          </p>

          <button
            className="db-button-primary"
            style={{ width: "100%", marginTop: "14px" }}
            onClick={() => setShowTrainingForm((current) => !current)}
          >
            {showTrainingForm ? "Close Training Form" : "+ Add Training Record"}
          </button>

          {showTrainingForm && (
            <div style={{ marginTop: "16px" }}>
              <select
                className="db-input"
                value={trainingSchoolId}
                onChange={(event) => setTrainingSchoolId(event.target.value)}
              >
                <option value="">Select school</option>
                {sponsoredSchools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.school_name || "Unnamed school"}
                  </option>
                ))}
              </select>

              <input
                className="db-input"
                type="date"
                value={trainingDate}
                onChange={(event) => setTrainingDate(event.target.value)}
              />

              <input
                className="db-input"
                placeholder="Training type"
                value={trainingType}
                onChange={(event) => setTrainingType(event.target.value)}
              />

              <input
                className="db-input"
                type="number"
                min="0"
                placeholder="Attendees"
                value={trainingAttendees}
                onChange={(event) => setTrainingAttendees(event.target.value)}
              />

              <textarea
                className="db-input"
                placeholder="Notes"
                value={trainingNotes}
                onChange={(event) => setTrainingNotes(event.target.value)}
                style={{ minHeight: "92px", paddingTop: "12px" }}
              />

              <button
                className="db-button-primary"
                style={{ width: "100%" }}
                onClick={createTrainingRecord}
                disabled={savingTraining}
              >
                {savingTraining ? "Saving..." : "Save Training Record"}
              </button>
            </div>
          )}

          <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
            {trainingRecordsForSponsor.length === 0 ? (
              <p className="db-helper">No training records captured yet.</p>
            ) : (
              trainingRecordsForSponsor.map((record) => (
                <div key={record.id} className="db-list-card">
                  <strong>{record.training_type}</strong>
                  <p style={textStyle}>
                    School: {record.schools?.school_name || "Not linked"}
                  </p>
                  <p style={textStyle}>Date: {record.training_date}</p>
                  <p style={textStyle}>
                    Attendees: {Number(record.attendees_count || 0)}
                  </p>
                  {record.notes && <p style={textStyle}>Notes: {record.notes}</p>}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="db-card db-card-lavender" style={{ padding: "20px" }}>
          <h2 style={sectionTitle}>Success Stories</h2>
          <p style={textStyle}>
            Capture school stories, before-and-after admin improvements, parent
            communication wins and learner support outcomes.
          </p>

          <button
            className="db-button-primary"
            style={{ width: "100%", marginTop: "14px" }}
            onClick={() => setShowStoryForm((current) => !current)}
          >
            {showStoryForm ? "Close Story Form" : "+ Add Success Story"}
          </button>

          {showStoryForm && (
            <div style={{ marginTop: "16px" }}>
              <select
                className="db-input"
                value={storySchoolId}
                onChange={(event) => setStorySchoolId(event.target.value)}
              >
                <option value="">Select school</option>
                {sponsoredSchools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.school_name || "Unnamed school"}
                  </option>
                ))}
              </select>

              <input
                className="db-input"
                type="date"
                value={storyDate}
                onChange={(event) => setStoryDate(event.target.value)}
              />

              <input
                className="db-input"
                placeholder="Title"
                value={storyTitle}
                onChange={(event) => setStoryTitle(event.target.value)}
              />

              <textarea
                className="db-input"
                placeholder="Summary"
                value={storySummary}
                onChange={(event) => setStorySummary(event.target.value)}
                style={{ minHeight: "92px", paddingTop: "12px" }}
              />

              <textarea
                className="db-input"
                placeholder="Outcome"
                value={storyOutcome}
                onChange={(event) => setStoryOutcome(event.target.value)}
                style={{ minHeight: "92px", paddingTop: "12px" }}
              />

              <button
                className="db-button-primary"
                style={{ width: "100%" }}
                onClick={createSuccessStory}
                disabled={savingStory}
              >
                {savingStory ? "Saving..." : "Save Success Story"}
              </button>
            </div>
          )}

          <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
            {successStoriesForSponsor.length === 0 ? (
              <p className="db-helper">No success stories captured yet.</p>
            ) : (
              successStoriesForSponsor.map((story) => (
                <div key={story.id} className="db-list-card">
                  <strong>{story.title}</strong>
                  <p style={textStyle}>
                    School: {story.schools?.school_name || "Not linked"}
                  </p>
                  <p style={textStyle}>Date: {story.story_date}</p>
                  {story.summary && (
                    <p style={textStyle}>Summary: {story.summary}</p>
                  )}
                  {story.outcome && (
                    <p style={textStyle}>Outcome: {story.outcome}</p>
                  )}
                </div>
              ))
            )}
          </div>
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
        gap: "14px",
        borderBottom: "1px solid #eee",
        padding: "10px 0",
      }}
    >
      <span style={{ color: "var(--db-text-soft)" }}>{label}</span>
      <strong style={{ textAlign: "right" }}>{value}</strong>
    </div>
  );
}

function PaginationButtons({
  currentPage,
  totalItems,
  onPrevious,
  onNext,
}: {
  currentPage: number;
  totalItems: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const hasPrevious = currentPage > 0;
  const hasNext = (currentPage + 1) * 5 < totalItems;

  if (!hasPrevious && !hasNext) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        justifyContent: "flex-end",
        marginTop: "14px",
      }}
    >
      <button style={secondaryButton} onClick={onPrevious} disabled={!hasPrevious}>
        Previous
      </button>

      <button style={secondaryButton} onClick={onNext} disabled={!hasNext}>
        Next
      </button>
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

const secondaryButton = {
  border: "1px solid #E3D9CD",
  background: "#FFFFFF",
  color: "#5B5675",
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 600,
  cursor: "pointer",
};