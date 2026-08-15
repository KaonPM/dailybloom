"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveSchoolContext } from "../lib/school-context";
import { getCurrentProfile } from "../lib/auth";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { LearnerMonthlyFeeSelect } from "./MonthlyFeeOptions";
import {
  duplicateLearnerDisplayName,
  findLearnerDuplicate,
} from "../lib/learner-duplicates";

type LearnerRow = {
  id: string;
  name?: string | null;
  legal_name?: string | null;
  class?: string | null;
  classroom_id?: number | null;
  date_of_birth?: string | null;
  birth_certificate_number?: string | null;
  sa_id_number?: string | null;
  passport_number?: string | null;
  admission_number?: string | null;
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
  monthly_fee?: number | null;
  monthly_fee_type_id?: number | null;
  fee_billing_start_date?: string | null;
  registration_fee_amount?: number | null;
  registration_fee_paid_at?: string | null;
  registration_fee_payment_method?: string | null;
  registration_fee_reference?: string | null;
  has_medical_aid?: boolean | null;
  medical_aid_name?: string | null;
  medical_aid_number?: string | null;
  medical_aid_main_member?: string | null;
  medical_aid_phone?: string | null;
  family_doctor_name?: string | null;
  family_doctor_phone?: string | null;
  preferred_hospital?: string | null;
  allergies?: string | null;
  medical_conditions?: string | null;
  medical_instructions?: string | null;
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

type SchoolFeeType = {
  id: number;
  fee_code: string;
  fee_name: string;
  fee_category: "registration" | "monthly" | "other";
  billing_frequency: "once_off" | "monthly";
  amount: number;
};

const LEARNERS_PER_PAGE = 20;

function nextMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}

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
  const [passportNumber, setPassportNumber] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("South African");
  const [homeLanguage, setHomeLanguage] = useState("");
  const [supportNeeds, setSupportNeeds] = useState("");

  const [guardianName, setGuardianName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [guardianIdNumber, setGuardianIdNumber] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [hasMedicalAid, setHasMedicalAid] = useState(false);
  const [medicalAidName, setMedicalAidName] = useState("");
  const [medicalAidNumber, setMedicalAidNumber] = useState("");
  const [medicalAidMainMember, setMedicalAidMainMember] = useState("");
  const [medicalAidPhone, setMedicalAidPhone] = useState("");
  const [familyDoctorName, setFamilyDoctorName] = useState("");
  const [familyDoctorPhone, setFamilyDoctorPhone] = useState("");
  const [preferredHospital, setPreferredHospital] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medicalConditions, setMedicalConditions] = useState("");
  const [medicalInstructions, setMedicalInstructions] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [monthlyFeeTypeId, setMonthlyFeeTypeId] = useState("");
  const [registrationFeeAmount, setRegistrationFeeAmount] = useState("");
  const [registrationFeePaid, setRegistrationFeePaid] = useState(false);
  const [registrationPaymentMethod, setRegistrationPaymentMethod] =
    useState("Cash");
  const [registrationReference, setRegistrationReference] = useState("");
  const [schoolFeeTypes, setSchoolFeeTypes] = useState<SchoolFeeType[]>([]);
  const [selectedOtherFeeIds, setSelectedOtherFeeIds] = useState<number[]>([]);
  const [schoolRegistrationFee, setSchoolRegistrationFee] = useState("");
  const [schoolMonthlyFee, setSchoolMonthlyFee] = useState("");

  const [manualClassroomId, setManualClassroomId] = useState("");
  const [suggestedAgeGroup, setSuggestedAgeGroup] = useState("");

  const [selectedLearner, setSelectedLearner] = useState<LearnerRow | null>(
    null
  );
  const [showForm, setShowForm] = useState(
    () => searchParams.get("action") === "add"
  );
  const [learnersListOpen, setLearnersListOpen] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [learnerSearch, setLearnerSearch] = useState("");
  const [learnerPage, setLearnerPage] = useState(1);

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

    const pageRequests: Promise<unknown>[] = [
      fetchClassrooms(context.schoolId),
      fetchLearners(context.schoolId),
    ];

    // Teachers only need their assigned-class learner list. The fee catalogue
    // is a billing-management resource and requesting it for teachers produces
    // an unnecessary permission warning when they open Learners.
    if (currentProfile.role !== "teacher") {
      pageRequests.push(fetchSchoolFeeCatalog(context.schoolId));
    }

    await Promise.all(pageRequests);

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
        passport_number,
        admission_number,
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
        deleted_name,
        monthly_fee,
        monthly_fee_type_id,
        fee_billing_start_date,
        registration_fee_amount,
        registration_fee_paid_at,
        registration_fee_payment_method,
        registration_fee_reference
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

  async function fetchSchoolFeeCatalog(
    currentSchoolId: number,
    learnerId?: string
  ) {
    const query = new URLSearchParams({
      school_id: String(currentSchoolId),
    });
    if (learnerId) query.set("learner_id", learnerId);

    const response = await authenticatedFetch(
      `/api/school-fees/catalog?${query.toString()}`
    );
    const result = await response.json();
    if (!response.ok) {
      alert(result.error || "Could not load the school fee setup.");
      return null;
    }

    const fees = (result.fees || []) as SchoolFeeType[];
    setSchoolFeeTypes(fees);
    setSchoolRegistrationFee(
      String(fees.find((fee) => fee.fee_category === "registration")?.amount || 0)
    );
    setSchoolMonthlyFee(
      String(fees.find((fee) => fee.fee_category === "monthly")?.amount || 0)
    );
    if (!learnerId) {
      const defaultMonthly = fees.find(
        (fee) => fee.fee_code === "monthly_school_fee"
      );
      setMonthlyFeeTypeId(defaultMonthly ? String(defaultMonthly.id) : "");
    }
    if (learnerId) {
      setSelectedOtherFeeIds(
        (result.selected_fee_ids || []).map(Number).filter(Boolean)
      );
    }
    return { fees, selectedFeeIds: result.selected_fee_ids || [] };
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

  const searchedLearners = useMemo(() => {
    const searchValue = learnerSearch.trim().toLowerCase();

    if (searchValue.length < 3) {
      return visibleLearners;
    }

    return visibleLearners.filter((learner) =>
      [learner.name, learner.legal_name].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(searchValue)
      )
    );
  }, [learnerSearch, visibleLearners]);

  const learnerPageCount = Math.max(
    1,
    Math.ceil(searchedLearners.length / LEARNERS_PER_PAGE)
  );
  const activeLearnerPage = Math.min(learnerPage, learnerPageCount);
  const paginatedLearners = searchedLearners.slice(
    (activeLearnerPage - 1) * LEARNERS_PER_PAGE,
    activeLearnerPage * LEARNERS_PER_PAGE
  );
  const firstLearnerNumber =
    searchedLearners.length === 0
      ? 0
      : (activeLearnerPage - 1) * LEARNERS_PER_PAGE + 1;
  const lastLearnerNumber = Math.min(
    activeLearnerPage * LEARNERS_PER_PAGE,
    searchedLearners.length
  );

  function resetForm() {
    setName("");
    setLegalName("");
    setDateOfBirth("");
    setBirthCertificateNumber("");
    setSaIdNumber("");
    setPassportNumber("");
    setAdmissionNumber("");
    setGender("");
    setNationality("South African");
    setHomeLanguage("");
    setSupportNeeds("");
    setGuardianName("");
    setGuardianRelationship("");
    setGuardianIdNumber("");
    setParentPhone("");
    setParentEmail("");
    setHasMedicalAid(false);
    setMedicalAidName("");
    setMedicalAidNumber("");
    setMedicalAidMainMember("");
    setMedicalAidPhone("");
    setFamilyDoctorName("");
    setFamilyDoctorPhone("");
    setPreferredHospital("");
    setAllergies("");
    setMedicalConditions("");
    setMedicalInstructions("");
    setMonthlyFee(schoolMonthlyFee);
    const defaultMonthly = schoolFeeTypes.find(
      (fee) => fee.fee_code === "monthly_school_fee"
    );
    setMonthlyFeeTypeId(defaultMonthly ? String(defaultMonthly.id) : "");
    setRegistrationFeeAmount(schoolRegistrationFee);
    setRegistrationFeePaid(false);
    setRegistrationPaymentMethod("Cash");
    setRegistrationReference("");
    setSelectedOtherFeeIds([]);
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

  async function editLearner(learner: LearnerRow) {
    setSelectedLearner(learner);

    setName(learner.name || "");
    setLegalName(learner.legal_name || "");
    setDateOfBirth(learner.date_of_birth || "");
    setBirthCertificateNumber(learner.birth_certificate_number || "");
    setSaIdNumber(learner.sa_id_number || "");
    setPassportNumber(learner.passport_number || "");
    setAdmissionNumber(learner.admission_number || "");
    setGender(learner.gender || "");
    setNationality(learner.nationality || "");
    setHomeLanguage(learner.home_language || "");
    setSupportNeeds(learner.support_needs || "");
    setGuardianName(learner.guardian_name || "");
    setGuardianRelationship(learner.guardian_relationship || "");
    setGuardianIdNumber(learner.guardian_id_number || "");
    setParentPhone(learner.parent_phone || "");
    setParentEmail(learner.parent_email || "");
    setHasMedicalAid(Boolean(learner.has_medical_aid));
    setMedicalAidName(learner.medical_aid_name || "");
    setMedicalAidNumber(learner.medical_aid_number || "");
    setMedicalAidMainMember(learner.medical_aid_main_member || "");
    setMedicalAidPhone(learner.medical_aid_phone || "");
    setFamilyDoctorName(learner.family_doctor_name || "");
    setFamilyDoctorPhone(learner.family_doctor_phone || "");
    setPreferredHospital(learner.preferred_hospital || "");
    setAllergies(learner.allergies || "");
    setMedicalConditions(learner.medical_conditions || "");
    setMedicalInstructions(learner.medical_instructions || "");
    setMonthlyFee(
      learner.monthly_fee === null || learner.monthly_fee === undefined
        ? ""
        : String(learner.monthly_fee)
    );
    const matchingMonthlyFee = schoolFeeTypes.find(
      (fee) =>
        fee.fee_category === "monthly" &&
        Number(fee.amount) === Number(learner.monthly_fee || 0)
    );
    setMonthlyFeeTypeId(
      learner.monthly_fee_type_id
        ? String(learner.monthly_fee_type_id)
        : matchingMonthlyFee
        ? String(matchingMonthlyFee.id)
        : ""
    );
    setRegistrationFeeAmount(
      learner.registration_fee_amount === null ||
        learner.registration_fee_amount === undefined
        ? ""
        : String(learner.registration_fee_amount)
    );
    setRegistrationFeePaid(Boolean(learner.registration_fee_paid_at));
    setRegistrationPaymentMethod(
      learner.registration_fee_payment_method || "Cash"
    );
    setRegistrationReference(learner.registration_fee_reference || "");
    setManualClassroomId(
      learner.classroom_id ? String(learner.classroom_id) : ""
    );
    if (schoolId) {
      await fetchSchoolFeeCatalog(schoolId, learner.id);
    }

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

    const parsedMonthlyFee = Number(monthlyFee || 0);
    const parsedRegistrationFee = Number(registrationFeeAmount || 0);
    if (
      Number.isNaN(parsedMonthlyFee) ||
      parsedMonthlyFee < 0 ||
      Number.isNaN(parsedRegistrationFee) ||
      parsedRegistrationFee < 0
    ) {
      alert("Please enter valid school fee amounts.");
      return;
    }
    if (registrationFeePaid && parsedRegistrationFee <= 0) {
      alert("Enter the registration fee amount before marking it as paid.");
      return;
    }
    if (!monthlyFeeTypeId || parsedMonthlyFee <= 0) {
      alert("Select the learner's monthly school fee.");
      return;
    }

    const duplicate = findLearnerDuplicate(
      {
        legalName,
        dateOfBirth,
        birthCertificateNumber,
        saIdNumber,
        passportNumber,
      },
      learners,
      selectedLearner?.id
    );

    if (duplicate?.kind === "identifier") {
      const existingName = duplicateLearnerDisplayName(duplicate.learner);
      setLearnerSearch(existingName);
      setLearnerPage(1);
      alert(
        `This learner may already be registered. ${existingName} has the same ${duplicate.field}. Review the existing learner instead of creating another record.`
      );
      return;
    }

    if (duplicate?.kind === "identity") {
      const existingName = duplicateLearnerDisplayName(duplicate.learner);
      const confirmedDifferentLearner = window.confirm(
        `Possible duplicate learner: ${existingName} has the same full legal name and date of birth.\n\nSelect Cancel to review the existing learner. Select OK only if these are different learners.`
      );
      if (!confirmedDifferentLearner) {
        setLearnerSearch(existingName);
        setLearnerPage(1);
        return;
      }
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
      passport_number: passportNumber.trim() || null,
      admission_number: admissionNumber.trim() || null,
      gender,
      nationality: nationality || null,
      home_language: homeLanguage,
      support_needs: supportNeeds.trim() || null,
      guardian_name: guardianName.trim(),
      guardian_relationship: guardianRelationship || null,
      guardian_id_number: guardianIdNumber.trim() || null,
      parent_phone: parentPhone.trim(),
      parent_email: parentEmail.trim() || null,
      has_medical_aid: hasMedicalAid,
      medical_aid_name: hasMedicalAid ? medicalAidName.trim() || null : null,
      medical_aid_number: hasMedicalAid ? medicalAidNumber.trim() || null : null,
      medical_aid_main_member: hasMedicalAid
        ? medicalAidMainMember.trim() || null
        : null,
      medical_aid_phone: hasMedicalAid ? medicalAidPhone.trim() || null : null,
      family_doctor_name: familyDoctorName.trim() || null,
      family_doctor_phone: familyDoctorPhone.trim() || null,
      preferred_hospital: preferredHospital.trim() || null,
      allergies: allergies.trim() || null,
      medical_conditions: medicalConditions.trim() || null,
      medical_instructions: medicalInstructions.trim() || null,
      ulin: selectedLearner ? selectedLearner.ulin || null : null,
      school_id: schoolId,
      monthly_fee: parsedMonthlyFee,
      monthly_fee_type_id: Number(monthlyFeeTypeId),
      fee_billing_start_date:
        selectedLearner?.fee_billing_start_date || nextMonthStart(),
      registration_fee_amount: parsedRegistrationFee,
      registration_fee_paid_at: registrationFeePaid
        ? selectedLearner?.registration_fee_paid_at ||
          new Date().toISOString().slice(0, 10)
        : null,
      registration_fee_payment_method: registrationFeePaid
        ? registrationPaymentMethod
        : null,
      registration_fee_reference:
        registrationFeePaid && registrationReference.trim()
          ? registrationReference.trim()
          : null,
    };

    let savedLearnerId = selectedLearner?.id || "";
    if (selectedLearner) {
      const { error } = await supabase
        .from("learners")
        .update(learnerPayload)
        .eq("id", selectedLearner.id)
        .eq("school_id", schoolId);

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }
    } else {
      const createLearner = (id: string) =>
        supabase
          .from("learners")
          .insert([{ ...learnerPayload, id }])
          .select("id")
          .single();

      let result = await createLearner(crypto.randomUUID());
      if (
        result.error?.code === "23505" &&
        result.error.message.includes("learners_pkey")
      ) {
        result = await createLearner(crypto.randomUUID());
      }

      if (result.error) {
        alert(result.error.message);
        setSaving(false);
        return;
      }
      savedLearnerId = String(result.data.id);
    }

    const feeResponse = await authenticatedFetch("/api/school-fees/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        school_id: schoolId,
        action: "sync_learner",
        learner_id: savedLearnerId,
        fee_ids: selectedOtherFeeIds,
      }),
    });
    const feeResult = await feeResponse.json();
    if (!feeResponse.ok) {
      alert(
        `Learner saved, but additional fees could not be updated: ${
          feeResult.error || "Unknown error"
        }`
      );
      setSaving(false);
      return;
    }

    resetForm();
    setShowForm(false);
    await fetchLearners(schoolId);

    setSaving(false);
    alert("Learner saved. Go to Parent Portal Access to invite the parent.");
  }

  if (loading) {
    return <p>Loading learners...</p>;
  }

  const canAddLearner = profile?.role !== "teacher";
  const selectedClassroom = classrooms.find(
    (classroom) => String(classroom.id) === manualClassroomId
  );
  const selectedClassroomIsGradeR =
    /\bgrade\s*r\b/i.test(selectedClassroom?.classroom_name || "") &&
    !/\bgrade\s*rr\b/i.test(selectedClassroom?.classroom_name || "");
  const registrationAlreadyRecorded = Boolean(
    selectedLearner?.registration_fee_paid_at
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
              <Link href={`/master/school/${schoolId}`} className="db-main-pill" style={backButton}>
                Back to School Overview
              </Link>
            ) : null}
          </div>

          {canAddLearner && activeFilter !== "birthdays-today" ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href={`/parent-access${schoolId ? `?school=${schoolId}` : ""}`} className="db-main-pill">
                Parent Portal Access
              </Link>
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
            </div>
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
              <p style={labelText}>Passport Number</p>
              <input
                className="db-input"
                placeholder="If the learner uses a passport"
                value={passportNumber}
                onChange={(event) => setPassportNumber(event.target.value)}
              />
            </div>
            {selectedClassroomIsGradeR ? (
              <div>
                <p style={labelText}>Admission Number</p>
                <input
                  className="db-input"
                  placeholder="Optional — may be added later"
                  value={admissionNumber}
                  onChange={(event) => setAdmissionNumber(event.target.value)}
                />
              </div>
            ) : null}
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
                disabled={Boolean(selectedLearner)}
              />
              {selectedLearner ? (
                <p style={helperText}>
                  Change portal access safely from the learner profile.
                </p>
              ) : null}
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

          <details className="db-soft-card" style={{ padding: 14, margin: "16px 0" }}>
            <summary style={{ cursor: "pointer", fontWeight: 800 }}>
              Medical Aid Information
            </summary>
            <div style={{ marginTop: 14 }}>
              <div style={grid2}>
                <div>
                  <p style={labelText}>Learner has medical aid</p>
                  <select
                    className="db-input"
                    value={hasMedicalAid ? "yes" : "no"}
                    onChange={(event) => setHasMedicalAid(event.target.value === "yes")}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>

              {hasMedicalAid ? (
                <div style={grid2}>
                  <div>
                    <p style={labelText}>Medical Aid Name</p>
                    <input className="db-input" value={medicalAidName} onChange={(event) => setMedicalAidName(event.target.value)} />
                  </div>
                  <div>
                    <p style={labelText}>Membership Number</p>
                    <input className="db-input" value={medicalAidNumber} onChange={(event) => setMedicalAidNumber(event.target.value)} />
                  </div>
                  <div>
                    <p style={labelText}>Main Member</p>
                    <input className="db-input" value={medicalAidMainMember} onChange={(event) => setMedicalAidMainMember(event.target.value)} />
                  </div>
                  <div>
                    <p style={labelText}>Medical Aid Telephone</p>
                    <input className="db-input" inputMode="tel" value={medicalAidPhone} onChange={(event) => setMedicalAidPhone(event.target.value)} />
                  </div>
                </div>
              ) : null}

              <div style={grid2}>
                <div>
                  <p style={labelText}>Family Doctor</p>
                  <input className="db-input" value={familyDoctorName} onChange={(event) => setFamilyDoctorName(event.target.value)} />
                </div>
                <div>
                  <p style={labelText}>Doctor Telephone</p>
                  <input className="db-input" inputMode="tel" value={familyDoctorPhone} onChange={(event) => setFamilyDoctorPhone(event.target.value)} />
                </div>
                <div>
                  <p style={labelText}>Preferred Hospital</p>
                  <input className="db-input" value={preferredHospital} onChange={(event) => setPreferredHospital(event.target.value)} />
                </div>
              </div>

              <div style={grid2}>
                <div>
                  <p style={labelText}>Allergies</p>
                  <textarea className="db-input" value={allergies} onChange={(event) => setAllergies(event.target.value)} style={{ minHeight: 72 }} />
                </div>
                <div>
                  <p style={labelText}>Medical Conditions</p>
                  <textarea className="db-input" value={medicalConditions} onChange={(event) => setMedicalConditions(event.target.value)} style={{ minHeight: 72 }} />
                </div>
              </div>

              <div>
                <p style={labelText}>Special Medical Instructions</p>
                <textarea className="db-input" value={medicalInstructions} onChange={(event) => setMedicalInstructions(event.target.value)} style={{ minHeight: 72 }} />
              </div>
            </div>
          </details>

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

          <h4 style={subSectionTitle}>Learner Fees</h4>

          <p style={helperText}>
            Standard amounts come from School Fee Setup. The monthly fee repeats
            on the 1st; registration and selected other fees are once-off.
          </p>

          <div style={grid2}>
            <div>
              <p style={labelText}>Monthly School Fee</p>
              <LearnerMonthlyFeeSelect
                options={schoolFeeTypes.filter((fee) => fee.fee_category === "monthly")}
                value={monthlyFeeTypeId}
                onChange={(feeId, amount) => {
                  setMonthlyFeeTypeId(feeId);
                  setMonthlyFee(String(amount));
                }}
              />
            </div>

            <div>
              <p style={labelText}>Registration Fee</p>
              <input
                className="db-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="Once-off registration amount"
                value={registrationFeeAmount}
                readOnly
              />
            </div>
          </div>

          {schoolFeeTypes.some((fee) => fee.fee_category === "other") ? (
            <div style={{ marginBottom: 14 }}>
              <p style={labelText}>Other Fees (optional)</p>
              <select
                className="db-input"
                value=""
                onChange={(event) => {
                  const feeId = Number(event.target.value);
                  if (feeId) {
                    setSelectedOtherFeeIds((current) =>
                      current.includes(feeId) ? current : [...current, feeId]
                    );
                  }
                }}
              >
                <option value="">Select an additional fee</option>
                {schoolFeeTypes
                  .filter(
                    (fee) =>
                      fee.fee_category === "other" &&
                      !selectedOtherFeeIds.includes(fee.id)
                  )
                  .map((fee) => (
                    <option key={fee.id} value={fee.id}>
                      {fee.fee_name} · R{Number(fee.amount).toFixed(2)}
                    </option>
                  ))}
              </select>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {selectedOtherFeeIds.map((feeId) => {
                  const fee = schoolFeeTypes.find((item) => item.id === feeId);
                  if (!fee) return null;
                  return (
                    <button
                      key={feeId}
                      type="button"
                      className="db-main-pill"
                      onClick={() =>
                        setSelectedOtherFeeIds((current) =>
                          current.filter((id) => id !== feeId)
                        )
                      }
                    >
                      {fee.fee_name} · R{Number(fee.amount).toFixed(2)} ×
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "10px 0 14px",
              fontWeight: 800,
              color: "#2D2A3E",
            }}
          >
            <input
              type="checkbox"
              checked={registrationFeePaid}
              onChange={(e) => setRegistrationFeePaid(e.target.checked)}
              disabled={registrationAlreadyRecorded}
            />
            Registration fee paid
          </label>

          {registrationFeePaid ? (
            <div style={grid2}>
              <div>
                <p style={labelText}>Registration Payment Method</p>
                <select
                  className="db-input"
                  value={registrationPaymentMethod}
                  onChange={(e) =>
                    setRegistrationPaymentMethod(e.target.value)
                  }
                  disabled={registrationAlreadyRecorded}
                >
                  <option value="Cash">Cash</option>
                  <option value="EFT">EFT</option>
                  <option value="Bank Deposit">Bank Deposit</option>
                  <option value="Card">Card</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <p style={labelText}>Payment Reference (optional)</p>
                <input
                  className="db-input"
                  placeholder="Receipt or transaction reference"
                  value={registrationReference}
                  onChange={(e) => setRegistrationReference(e.target.value)}
                  disabled={registrationAlreadyRecorded}
                />
              </div>
            </div>
          ) : null}

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
            ? `Birthdays Today (${searchedLearners.length})`
            : `Learners (${searchedLearners.length})`}
        </h3>

        <button type="button" className="db-button-secondary" onClick={() => setLearnersListOpen((current) => !current)} aria-expanded={learnersListOpen}>
          {learnersListOpen ? "Close" : "Open"} list
        </button>

        {learnersListOpen ? <>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <label style={{ flex: "1 1 280px" }}>
            <span style={labelText}>Search learners</span>
            <input
              className="db-input"
              type="search"
              value={learnerSearch}
              placeholder="Type at least 3 letters of a learner's name"
              onChange={(event) => {
                setLearnerSearch(event.target.value);
                setLearnerPage(1);
              }}
            />
          </label>

          <span className="db-helper" style={{ margin: "0 0 10px" }}>
            {learnerSearch.trim().length > 0 &&
            learnerSearch.trim().length < 3
              ? "Enter 3 letters to start searching."
              : searchedLearners.length > 0
              ? `Showing ${firstLearnerNumber}-${lastLearnerNumber} of ${searchedLearners.length}`
              : "No matching learners"}
          </span>
        </div>

        {searchedLearners.length === 0 ? (
          <p className="db-helper">
            {learnerSearch.trim().length >= 3
              ? "No learners match your search."
              : profile?.role === "teacher"
              ? "No learners found for your assigned classroom."
              : "No learners added yet."}
          </p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 10,
              }}
            >
              {paginatedLearners.map((learner) => {
                const active = selectedLearner?.id === learner.id;

                return (
                  <div
                    key={learner.id}
                    style={{
                      background: active ? "#EAF7FD" : "#FFFDFB",
                      border: active
                        ? "1px solid #CBEAF7"
                        : "1px solid #F0E3D8",
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
                    </div>
                  ) : null}
                  </div>
                );
              })}
            </div>

            {learnerPageCount > 1 ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 16,
                }}
              >
                <button
                  type="button"
                  className="db-button-secondary"
                  disabled={activeLearnerPage === 1}
                  onClick={() =>
                    setLearnerPage((currentPage) =>
                      Math.max(1, currentPage - 1)
                    )
                  }
                >
                  Previous 20
                </button>
                <span className="db-helper" style={{ margin: 0 }}>
                  Page {activeLearnerPage} of {learnerPageCount}
                </span>
                <button
                  type="button"
                  className="db-button-secondary"
                  disabled={activeLearnerPage === learnerPageCount}
                  onClick={() =>
                    setLearnerPage((currentPage) =>
                      Math.min(learnerPageCount, currentPage + 1)
                    )
                  }
                >
                  Next 20
                </button>
              </div>
            ) : null}
          </>
        )}
        </> : null}
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
