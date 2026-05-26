"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveSchoolContext } from "../lib/school-context";
import { getCurrentProfile } from "../lib/auth";

type LearnerRow = {
  id: number;
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
  receiving_school?: string | null;
  ulin?: string | null;
  school_id?: number | null;
};

type ClassroomRow = {
  id: number;
  classroom_name?: string | null;
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

  const [receivingSchool, setReceivingSchool] = useState("");
  const [manualClassroomId, setManualClassroomId] = useState("");

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
      .select("id, classroom_name")
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
        receiving_school,
        ulin,
        school_id
      `
      )
      .eq("school_id", currentSchoolId)
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
    setReceivingSchool("");
    setManualClassroomId("");
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

  function calculateAge(dateValue: string) {
    const today = new Date();
    const birthDate = new Date(dateValue);

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  function getAgeGroup(age: number) {
    if (age <= 0) return "0-1";
    if (age === 1) return "1-2";
    if (age === 2) return "2-3";
    if (age === 3) return "3-4";
    if (age === 4) return "4-5";
    return "5-6";
  }

  function findClassroomByAgeGroup(ageGroup: string) {
    const normalizedAgeGroup = ageGroup.replace(/\s/g, "").toLowerCase();

    return classrooms.find((classroom) => {
      const classroomName = String(classroom.classroom_name || "")
        .replace(/\s/g, "")
        .toLowerCase();

      return classroomName.includes(normalizedAgeGroup);
    });
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
      alert("Please enter parent or guardian phone number.");
      return;
    }

    setSaving(true);

    const learnerAge = calculateAge(dateOfBirth);
    const ageGroup = getAgeGroup(learnerAge);

    let classroomMatch: ClassroomRow | null = null;

    if (manualClassroomId) {
      classroomMatch =
        classrooms.find(
          (classroom) => String(classroom.id) === manualClassroomId
        ) || null;
    } else {
      classroomMatch = findClassroomByAgeGroup(ageGroup) || null;
    }

    if (!classroomMatch) {
      alert(
        `No classroom found for age group ${ageGroup}. Please select a classroom manually.`
      );
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("learners").insert([
      {
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
        receiving_school: receivingSchool.trim() || null,
        ulin: null,
        school_id: schoolId,
      },
    ]);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    resetForm();
    setShowForm(false);
    await fetchLearners(schoolId);

    setSaving(false);
    alert(`Learner added and assigned to ${classroomMatch.classroom_name}.`);
  }

  if (loading) {
    return <p>Loading learners...</p>;
  }

  const canAddLearner = profile?.role !== "teacher";

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
          <h3 style={sectionTitle}>Add Learner</h3>

          <p style={helperText}>
            Capture the learner’s legal identity, guardian details and Grade R
            transition information in a structured format.
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
              <p style={labelText}>Guardian Full Name</p>
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
                onChange={(e) => setGuardianRelationship(e.target.value)}
              >
                <option value="">Select relationship</option>
                <option value="Mother">Mother</option>
                <option value="Father">Father</option>
                <option value="Guardian">Guardian</option>
                <option value="Grandparent">Grandparent</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div style={grid2}>
            <div>
              <p style={labelText}>Guardian ID Number</p>
              <input
                className="db-input"
                placeholder="ID or passport number"
                value={guardianIdNumber}
                onChange={(e) => setGuardianIdNumber(e.target.value)}
              />
            </div>

            <div>
              <p style={labelText}>Parent / Guardian Phone</p>
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
              <p style={labelText}>Parent / Guardian Email</p>
              <input
                className="db-input"
                type="email"
                placeholder="Email address"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
              />
            </div>

            <div>
              <p style={labelText}>Receiving School</p>
              <input
                className="db-input"
                placeholder="Future Grade R or Grade 1 school"
                value={receivingSchool}
                onChange={(e) => setReceivingSchool(e.target.value)}
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
            Leave blank to auto-assign by age, or choose a classroom manually.
          </div>

          <button
            type="button"
            className="db-button-primary"
            style={{ width: "100%", marginTop: 12 }}
            onClick={addLearner}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Learner"}
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
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            {visibleLearners.map((learner) => {
              const active = selectedLearner?.id === learner.id;

              return (
                <button
                  key={learner.id}
                  type="button"
                  onClick={() => setSelectedLearner(active ? null : learner)}
                  style={{
                    background: active ? "#EAF7FD" : "#FFFDFB",
                    border: active ? "1px solid #CBEAF7" : "1px solid #F0E3D8",
                    borderRadius: 16,
                    padding: 14,
                    textAlign: "left",
                    color: "#2D2A3E",
                    cursor: "pointer",
                  }}
                >
                  <strong style={{ display: "block", fontSize: 15 }}>
                    {learner.name || "Unnamed learner"}
                  </strong>

                  <span style={smallText}>
                    {learner.class || "Unassigned"}
                  </span>

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
                        Phone: {learner.parent_phone || "Not added"}
                      </p>
                      <p style={smallText}>
                        Email: {learner.parent_email || "Not added"}
                      </p>
                      <p style={smallText}>
                        Receiving School:{" "}
                        {learner.receiving_school || "Not added"}
                      </p>
                      <p style={smallText}>
                        ULIN / LURITS Ref:{" "}
                        {learner.ulin || "Not assigned yet"}
                      </p>
                    </div>
                  ) : null}
                </button>
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