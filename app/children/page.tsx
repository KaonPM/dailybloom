"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveSchoolContext } from "../lib/school-context";
import { getCurrentProfile } from "../lib/auth";

type LearnerRow = {
  id: string;
  name?: string | null;
  legal_name?: string | null;
  class?: string | null;
  classroom_id?: number | null;
  date_of_birth?: string | null;
  birth_certificate_number?: string | null;
  sa_id_number?: string | null;
  gender?: string | null;
  nationality?: string | null;
  home_language?: string | null;
  support_needs?: string | null;
  guardian_name?: string | null;
  guardian_relationship?: string | null;
  guardian_id_number?: string | null;
  parent_phone?: string | null;
  parent_email?: string | null;
  ulin?: string | null;
  school_id?: number | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  deleted_name?: string | null;
};

type ClassroomRow = {
  id: number;
  classroom_name?: string | null;
  age_groups?: string[] | null;
};

type ProfileRow = {
  role?: string | null;
  classroom_name?: string | null;
  school_id?: number | null;
};

export default function LearnersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeFilter = searchParams.get("filter");
  const schoolParam = searchParams.get("school");

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);

  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [birthCertificateNumber, setBirthCertificateNumber] = useState("");
  const [saIdNumber, setSaIdNumber] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("South African");
  const [homeLanguage, setHomeLanguage] = useState("");
  const [supportNeeds, setSupportNeeds] = useState("");

  const [guardianName, setGuardianName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [guardianIdNumber, setGuardianIdNumber] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");

  const [manualClassroomId, setManualClassroomId] = useState("");
  const [suggestedAgeGroup, setSuggestedAgeGroup] = useState("");

  const [selectedLearner, setSelectedLearner] = useState<LearnerRow | null>(
    null
  );
  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const { profile: currentProfile, error: profileError } =
      await getCurrentProfile();

    if (profileError || !currentProfile) {
      router.push("/login");
      return;
    }

    setProfile(currentProfile);

    const context = await resolveSchoolContext(schoolParam);

    if (context.error) {
      router.push("/login");
      return;
    }

    if (context.shouldReturnToMaster || !context.schoolId) {
      router.push("/master");
      return;
    }

    setSchoolId(context.schoolId);

    await Promise.all([
      fetchClassrooms(context.schoolId),
      fetchLearners(context.schoolId),
    ]);

    setLoading(false);
  }

  async function fetchClassrooms(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("classrooms")
      .select("id, classroom_name, age_groups")
      .eq("school_id", currentSchoolId)
      .order("classroom_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setClassrooms((data || []) as ClassroomRow[]);
  }

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select(
        `
        id,
        name,
        legal_name,
        class,
        classroom_id,
        date_of_birth,
        birth_certificate_number,
        sa_id_number,
        gender,
        nationality,
        home_language,
        support_needs,
        guardian_name,
        guardian_relationship,
        guardian_id_number,
        parent_phone,
        parent_email,
        ulin,
        school_id,
        is_deleted,
        deleted_at,
        deleted_name
      `
      )
      .eq("school_id", currentSchoolId)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as LearnerRow[]);
  }

  const teacherClassroom = String(profile?.classroom_name || "").trim();

  const teacherClassroomId = useMemo(() => {
    if (!teacherClassroom) return null;

    const match = classrooms.find(
      (room) =>
        String(room.classroom_name || "").trim().toLowerCase() ===
        teacherClassroom.toLowerCase()
    );

    return match?.id || null;
  }, [classrooms, teacherClassroom]);

  function calculateAge(dateString: string) {
    const today = new Date();
    const dob = new Date(dateString);

    let age = today.getFullYear() - dob.getFullYear();
    const monthDifference = today.getMonth() - dob.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < dob.getDate())
    ) {
      age--;
    }

    return age;
  }

  function determineAgeGroup(age: number) {
    if (age < 1) return "0-1 Years";
    if (age < 2) return "1-2 Years";
    if (age < 3) return "2-3 Years";
    if (age < 4) return "3-4 Years";
    if (age < 5) return "4-5 Years";

    return "5-6 Years";
  }

  useEffect(() => {
    if (!dateOfBirth || classrooms.length === 0) return;

    const age = calculateAge(dateOfBirth);
    const group = determineAgeGroup(age);

    setSuggestedAgeGroup(group);

    const matchedClassroom = classrooms.find((room) =>
      room.age_groups?.includes(group)
    );

    if (matchedClassroom) {
      setManualClassroomId(String(matchedClassroom.id));
    }
  }, [dateOfBirth, classrooms]);

  const visibleLearners = useMemo(() => {
    let scopedLearners = learners;

    if (profile?.role === "teacher") {
      scopedLearners = learners.filter((learner) => {
        const learnerClass = String(learner.class || "").trim().toLowerCase();
        const teacherClass = teacherClassroom.toLowerCase();

        return (
          learnerClass === teacherClass ||
          (teacherClassroomId !== null &&
            Number(learner.classroom_id) === Number(teacherClassroomId))
        );
      });
    }

    if (activeFilter === "birthdays-today") {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      return scopedLearners.filter((learner) => {
        if (!learner.date_of_birth) return false;

        const dob = new Date(learner.date_of_birth);
        return dob.getMonth() + 1 === month && dob.getDate() === day;
      });
    }

    return scopedLearners;
  }, [learners, profile, teacherClassroom, teacherClassroomId, activeFilter]);

  function resetForm() {
    setName("");
    setLegalName("");
    setDateOfBirth("");
    setBirthCertificateNumber("");
    setSaIdNumber("");
    setGender("");
    setNationality("South African");
    setHomeLanguage("");
    setSupportNeeds("");
    setGuardianName("");
    setGuardianRelationship("");
    setGuardianIdNumber("");
    setParentPhone("");
    setParentEmail("");
    setManualClassroomId("");
    setSuggestedAgeGroup("");
    setSelectedLearner(null);
  }

  function parseSAIDNumber(idNumber: string) {
    if (idNumber.length !== 13) {
      return {
        dateOfBirth: "",
        gender: "",
        nationality: "",
      };
    }

    const year = idNumber.substring(0, 2);
    const month = idNumber.substring(2, 4);
    const day = idNumber.substring(4, 6);

    const currentYear = Number(new Date().getFullYear().toString().slice(2));
    const fullYear = Number(year) <= currentYear ? `20${year}` : `19${year}`;

    const parsedDate = `${fullYear}-${month}-${day}`;
    const dateCheck = new Date(parsedDate);

    const isValidDate =
      dateCheck instanceof Date &&
      !Number.isNaN(dateCheck.getTime()) &&
      dateCheck.getFullYear() === Number(fullYear) &&
      dateCheck.getMonth() + 1 === Number(month) &&
      dateCheck.getDate() === Number(day);

    const genderDigits = Number(idNumber.substring(6, 10));
    const parsedGender = genderDigits >= 5000 ? "Male" : "Female";

    const citizenshipDigit = idNumber.substring(10, 11);
    const parsedNationality =
      citizenshipDigit === "0"
        ? "South African"
        : citizenshipDigit === "1"
        ? "Permanent resident"
        : "";

    return {
      dateOfBirth: isValidDate ? parsedDate : "",
      gender: parsedGender,
      nationality: parsedNationality,
    };
  }

  function handleSAIDNumberChange(value: string) {
    const cleanedValue = value.replace(/\D/g, "").slice(0, 13);

    setSaIdNumber(cleanedValue);

    if (cleanedValue.length === 13) {
      const parsed = parseSAIDNumber(cleanedValue);

      if (parsed.dateOfBirth) {
        setDateOfBirth(parsed.dateOfBirth);
      }

      if (parsed.gender) {
        setGender(parsed.gender);
      }

      if (parsed.nationality) {
        setNationality(parsed.nationality);
      }
    }
  }

  function viewLearner(learner: LearnerRow) {
    const schoolQuery = schoolParam ? `?school=${schoolParam}` : "";
    router.push(`/children/${learner.id}${schoolQuery}`);
  }

  function editLearner(learner: LearnerRow) {
    setSelectedLearner(learner);

    setName(learner.name || "");
    setLegalName(learner.legal_name || "");
    setDateOfBirth(learner.date_of_birth || "");
    setBirthCertificateNumber(learner.birth_certificate_number || "");
    setSaIdNumber(learner.sa_id_number || "");
    setGender(learner.gender || "");
    setNationality(learner.nationality || "");
    setHomeLanguage(learner.home_language || "");
    setSupportNeeds(learner.support_needs || "");
    setGuardianName(learner.guardian_name || "");
    setGuardianRelationship(learner.guardian_relationship || "");
    setGuardianIdNumber(learner.guardian_id_number || "");
    setParentPhone(learner.parent_phone || "");
    setParentEmail(learner.parent_email || "");
    setManualClassroomId(
      learner.classroom_id ? String(learner.classroom_id) : ""
    );

    setShowForm(true);
  }

  async function deleteLearner(learner: LearnerRow) {
    if (!schoolId) return;

    const confirmed = confirm(
      `Remove ${learner.name} from the active learner list? Historical attendance, summaries and payments will remain available in reports.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("learners")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_name: learner.name || learner.legal_name || "Deleted learner",
      })
      .eq("id", learner.id)
      .eq("school_id", schoolId);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchLearners(schoolId);

    if (selectedLearner?.id === learner.id) {
      resetForm();
      setShowForm(false);
    }

    alert("Learner removed from active list. Historical records were kept.");
  }

  async function addLearner() {
    if (!schoolId) return;

    if (!name.trim()) {
      alert("Please enter the learner's preferred name.");
      return;
    }

    if (!legalName.trim()) {
      alert("Please enter the learner's full legal name.");
      return;
    }

    if (!dateOfBirth) {
      alert(
        "Please enter date of birth so the learner can be assigned to the correct age group."
      );
      return;
    }

    if (!gender) {
      alert("Please select gender.");
      return;
    }

    if (!homeLanguage) {
      alert("Please select home language.");
      return;
    }

    if (!guardianName.trim()) {
      alert("Please enter parent or guardian name.");
      return;
    }

    if (!parentPhone.trim()) {
      alert("Please enter a contact number.");
      return;
    }

    setSaving(true);

    const learnerAge = calculateAge(dateOfBirth);
    const ageGroup = determineAgeGroup(learnerAge);

    const classroomMatch =
      classrooms.find((classroom) => String(classroom.id) === manualClassroomId) ||
      classrooms.find((classroom) => classroom.age_groups?.includes(ageGroup)) ||
      null;

    if (!classroomMatch) {
      alert(
        manualClassroomId
          ? "Selected classroom could not be found. Please choose another classroom."
          : `No classroom found for age group ${ageGroup}. Please select a classroom manually.`
      );
      setSaving(false);
      return;
    }

    const learnerPayload = {
      name: name.trim(),
      legal_name: legalName.trim(),
      class: classroomMatch.classroom_name || "Unassigned",
      classroom_id: classroomMatch.id,
      date_of_birth: dateOfBirth,
      birth_certificate_number: birthCertificateNumber.trim() || null,
      sa_id_number: saIdNumber.trim() || null,
      gender,
      nationality: nationality || null,
      home_language: homeLanguage,
      support_needs: supportNeeds.trim() || null,
      guardian_name: guardianName.trim(),
      guardian_relationship: guardianRelationship || null,
      guardian_id_number: guardianIdNumber.trim() || null,
      parent_phone: parentPhone.trim(),
      parent_email: parentEmail.trim() || null,
      ulin: selectedLearner ? selectedLearner.ulin || null : null,
      school_id: schoolId,
    };

    let learnerRecord;

if (selectedLearner) {
  const { data, error } = await supabase
    .from("learners")
    .update(learnerPayload)
    .eq("id", selectedLearner.id)
    .eq("school_id", schoolId)
    .select()
    .single();

  if (error) {
    alert(error.message);
    setSaving(false);
    return;
  }

  learnerRecord = data;
} else {
  const { data, error } = await supabase
    .from("learners")
    .insert([learnerPayload])
    .select()
    .single();

  if (error) {
    alert(error.message);
    setSaving(false);
    return;
  }

  learnerRecord = data;
}

// Automatically link learner to parent portal
const normalizedPhone = learnerRecord.parent_phone
  ?.replace(/\D/g, "")
  .replace(/^27/, "0");

if (normalizedPhone) {
  const { error: parentAccessError } =
    await supabase
      .from("parent_access")
      .upsert(
        {
          phone: normalizedPhone,
          learner_id: learnerRecord.id,
        },
        {
          onConflict: "phone,learner_id",
        }
      );

  if (parentAccessError) {
    console.error(
      "Parent access link failed:",
      parentAccessError
    );
  }
}
    resetForm();
    setShowForm(false);
    await fetchLearners(schoolId);

    setSaving(false);
    alert(
      selectedLearner
        ? `Learner updated and assigned to ${classroomMatch.classroom_name}.`
        : `Learner added and assigned to ${classroomMatch.classroom_name}.`
    );
  }

  if (loading) {
    return <p>Loading learners...</p>;
  }

  const canAddLearner = profile?.role !== "teacher";
  const selectedClassroom = classrooms.find(
    (classroom) => String(classroom.id) === manualClassroomId
  );

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 className="db-page-title">
              {activeFilter === "birthdays-today"
                ? "Today’s Birthdays"
                : "Learners"}
            </h2>

            <p className="db-page-subtitle">
              {profile?.role === "teacher"
                ? `Viewing learners for ${
                    teacherClassroom || "assigned classroom"
                  }.`
                : "Manage learner records using DBE-ready identity, guardian and transition fields."}
            </p>

            {schoolParam && schoolId ? (
              <Link href={`/master/school/${schoolId}`} style={backButton}>
                Back to School Overview
              </Link>
            ) : null}
          </div>

          {canAddLearner && activeFilter !== "birthdays-today" ? (
            <button
              type="button"
              className="db-button-primary"
              onClick={() => {
                resetForm();
                setShowForm((prev) => !prev);
              }}
            >
              {showForm ? "Close" : "+ Add Learner"}
            </button>
          ) : null}
        </div>
      </div>

      {showForm && canAddLearner ? (
        <div
          className="db-card db-card-blue"
          style={{ padding: 16, marginBottom: 18 }}
        >
          <h3 style={sectionTitle}>
            {selectedLearner ? "Edit Learner" : "Add Learner"}
          </h3>

          <p style={helperText}>
             Capture the learner’s legal identity and parent or guardian details in a structured format.
          </p>

          <h4 style={subSectionTitle}>Learner Identity</h4>

          <div style={grid2}>
            <div>
              <p style={labelText}>Preferred Name</p>
              <input
                className="db-input"
                placeholder="Name commonly used at school"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <p style={labelText}>Full Legal Name</p>
              <input
                className="db-input"
                placeholder="As per birth certificate"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </div>
          </div>

          <div style={grid2}>
            <div>
              <p style={labelText}>Date of Birth</p>
              <input
                className="db-input"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>

            <div>
              <p style={labelText}>Gender</p>
              <select
                className="db-input"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">Select gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
                <option value="Not specified">Not specified</option>
              </select>
            </div>
          </div>

          <div style={grid2}>
            <div>
              <p style={labelText}>Birth Certificate Number</p>
              <input
                className="db-input"
                placeholder="Birth certificate number"
                value={birthCertificateNumber}
                onChange={(e) => setBirthCertificateNumber(e.target.value)}
              />
            </div>

            <div>
              <p style={labelText}>SA ID Number</p>
              <input
                className="db-input"
                placeholder="If available"
                value={saIdNumber}
                onChange={(e) => handleSAIDNumberChange(e.target.value)}
              />
            </div>
          </div>

          <div style={grid2}>
            <div>
              <p style={labelText}>Nationality</p>
              <select
                className="db-input"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
              >
                <option value="">Select nationality</option>
                <option value="South African">South African</option>
                <option value="Non-South African">Non-South African</option>
                <option value="Permanent resident">Permanent resident</option>
                <option value="Refugee/asylum seeker">
                  Refugee/asylum seeker
                </option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>

            <div>
              <p style={labelText}>Home Language</p>
              <select
                className="db-input"
                value={homeLanguage}
                onChange={(e) => setHomeLanguage(e.target.value)}
              >
                <option value="">Select home language</option>
                <option value="Afrikaans">Afrikaans</option>
                <option value="English">English</option>
                <option value="isiNdebele">isiNdebele</option>
                <option value="isiXhosa">isiXhosa</option>
                <option value="isiZulu">isiZulu</option>
                <option value="Sepedi">Sepedi</option>
                <option value="Sesotho">Sesotho</option>
                <option value="Setswana">Setswana</option>
                <option value="SiSwati">SiSwati</option>
                <option value="Tshivenda">Tshivenda</option>
                <option value="itsonga">itsonga</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <p style={labelText}>Support Needs / Disability Status</p>
            <textarea
              className="db-input"
              placeholder="Example: None, speech support, mobility support, learning support"
              value={supportNeeds}
              onChange={(e) => setSupportNeeds(e.target.value)}
              style={{ minHeight: 80, resize: "vertical" }}
            />
          </div>

          <h4 style={subSectionTitle}>Parent / Guardian Details</h4>

          <div style={grid2}>
            <div>
              <p style={labelText}>Parent / Guardian Full Name</p>
              <input
                className="db-input"
                placeholder="Parent or guardian name"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
              />
            </div>

            <div>
              <p style={labelText}>Relationship to Learner</p>
              <select
                className="db-input"
                value={guardianRelationship}
                onChange={(e)=>setGuardianRelationship(e.target.value)}
>
                <option value="">Select relationship</option>
                <option value="Mother">Mother</option>
                <option value="Father">Father</option>
                <option value="Guardian">Guardian</option>
                <option value="Grandmother">Grandmother</option>
                <option value="Grandfather">Grandfather</option>
                <option value="Aunt">Aunt</option>
                <option value="Uncle">Uncle</option>
                <option value="Foster Parent">Foster Parent</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div style={grid2}>
            <div>
              <p style={labelText}>Parent / Guardian ID Number</p>
              <input
                className="db-input"
                placeholder="ID or passport number"
                value={guardianIdNumber}
                onChange={(e) => setGuardianIdNumber(e.target.value)}
              />
            </div>

            <div>
              <p style={labelText}>Contact Number</p>
              <input
                className="db-input"
                placeholder="Phone number"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
              />
            </div>
          </div>

          <div style={grid2}>
            <div>
              <p style={labelText}>Email Address</p>
              <input
                className="db-input"
                type="email"
                placeholder="Email address"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
              />
            </div>
          </div>

          <h4 style={subSectionTitle}>Classroom Assignment</h4>

          <div style={grid2}>
            <div>
              <p style={labelText}>Classroom</p>
              <select
                className="db-input"
                value={manualClassroomId}
                onChange={(e) => setManualClassroomId(e.target.value)}
              >
                <option value="">Auto-assign from date of birth</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.classroom_name}
                    {classroom.age_groups?.length
                      ? ` (${classroom.age_groups.join(", ")})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              background: "#FFFDFB",
              border: "1px solid #F0E3D8",
              borderRadius: 14,
              padding: "12px 14px",
              color: "#6D6888",
              fontSize: 13,
              fontWeight: 700,
              marginTop: 10,
            }}
          >
            {suggestedAgeGroup
              ? `Suggested age group: ${suggestedAgeGroup}. ${
                  selectedClassroom?.classroom_name
                    ? `Assigned classroom: ${selectedClassroom.classroom_name}.`
                    : "No matching classroom found yet."
                }`
              : "Leave blank to auto-assign by age, or choose a classroom manually."}
          </div>

          <button
            type="button"
            className="db-button-primary"
            style={{ width: "100%", marginTop: 12 }}
            onClick={addLearner}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : selectedLearner
              ? "Update Learner"
              : "Save Learner"}
          </button>
        </div>
      ) : null}

      <div className="db-card db-card-lavender" style={{ padding: 16 }}>
        <h3 style={sectionTitle}>
          {activeFilter === "birthdays-today"
            ? `Birthdays Today (${visibleLearners.length})`
            : `Learners (${visibleLearners.length})`}
        </h3>

        {visibleLearners.length === 0 ? (
          <p className="db-helper">
            {profile?.role === "teacher"
              ? "No learners found for your assigned classroom."
              : "No learners added yet."}
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 10,
            }}
          >
            {visibleLearners.map((learner) => {
              const active = selectedLearner?.id === learner.id;

              return (
                <div
                  key={learner.id}
                  style={{
                    background: active ? "#EAF7FD" : "#FFFDFB",
                    border: active ? "1px solid #CBEAF7" : "1px solid #F0E3D8",
                    borderRadius: 14,
                    padding: 12,
                    textAlign: "left",
                    color: "#2D2A3E",
                  }}
                >
                  <strong style={{ display: "block", fontSize: 15 }}>
                    {learner.name || "Unnamed learner"}
                  </strong>

                  <span style={smallText}>
                    {learner.class || "Unassigned"}
                  </span>

                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "nowrap",
                      marginTop: 10,
                      alignItems: "center",
                    }}
                  >
                    <button
                      type="button"
                      className="db-button-secondary"
                      style={learnerActionButton}
                      onClick={() => viewLearner(learner)}
                    >
                      View
                    </button>

                    {canAddLearner ? (
                      <>
                        <button
                          type="button"
                          className="db-button-secondary"
                          style={learnerActionButton}
                          onClick={() => editLearner(learner)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="db-button-secondary"
                          style={learnerActionButton}
                          onClick={() => deleteLearner(learner)}
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>

                  {active ? (
                    <div style={{ marginTop: 10 }}>
                      <p style={smallText}>
                        Legal Name: {learner.legal_name || "Not added"}
                      </p>
                      <p style={smallText}>
                        Date of Birth: {learner.date_of_birth || "Not added"}
                      </p>
                      <p style={smallText}>
                        Gender: {learner.gender || "Not added"}
                      </p>
                      <p style={smallText}>
                        Home Language: {learner.home_language || "Not added"}
                      </p>
                      <p style={smallText}>
                        Nationality: {learner.nationality || "Not added"}
                      </p>
                      <p style={smallText}>
                        Birth Certificate:{" "}
                        {learner.birth_certificate_number || "Not added"}
                      </p>
                      <p style={smallText}>
                        SA ID: {learner.sa_id_number || "Not added"}
                      </p>
                      <p style={smallText}>
                        Support Needs:{" "}
                        {learner.support_needs || "None recorded"}
                      </p>
                      <p style={smallText}>
                        Guardian: {learner.guardian_name || "Not added"}
                      </p>
                      <p style={smallText}>
                        Relationship:{" "}
                        {learner.guardian_relationship || "Not added"}
                      </p>
                      <p style={smallText}>
                        Guardian ID:{" "}
                        {learner.guardian_id_number || "Not added"}
                      </p>
                      <p style={smallText}>
                        Contact Number: {learner.parent_phone || "Not added"}
                      </p>
                      <p style={smallText}>
                        Email Address: {learner.parent_email || "Not added"}
                      </p>
                      <p style={smallText}>
                        ULIN / LURITS Ref:{" "}
                        {learner.ulin || "Not assigned yet"}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const sectionTitle = {
  margin: "0 0 10px 0",
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 700 as const,
};

const subSectionTitle = {
  margin: "18px 0 10px 0",
  color: "#2D2A3E",
  fontSize: 16,
  fontWeight: 800 as const,
};

const labelText = {
  margin: "0 0 8px 0",
  color: "#6D6888",
  fontSize: 13,
  fontWeight: 800,
};

const helperText = {
  margin: "0 0 14px 0",
  color: "#6D6888",
  fontSize: 13,
  lineHeight: 1.5,
};

const smallText = {
  display: "block",
  margin: "4px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
};

const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
  marginTop: 10,
};

const learnerActionButton = {
  minHeight: 34,
  padding: "7px 12px",
  fontSize: 13,
  flex: "1 1 0",
} as const;

const backButton = {
  display: "inline-block",
  marginTop: 12,
  textDecoration: "none",
  background: "#FFFFFF",
  color: "#2D2A3E",
  border: "1px solid #E3D9CD",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  fontSize: 13,
};