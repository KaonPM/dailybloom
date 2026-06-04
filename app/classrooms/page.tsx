"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";

type TemplateKey = "0_2" | "2_6";

type ClassroomRow = {
  id: number;
  school_id?: number | null;
  classroom_name?: string | null;
  age_groups?: string[] | null;
  stationery_templates?: TemplateKey[] | null;
  created_at?: string | null;
};

type LearnerRow = {
  id: string;
  name?: string | null;
  class?: string | null;
  classroom_id?: number | null;
};

type TeacherRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  classroom_name?: string | null;
  is_active?: boolean | null;
};

const ageGroupOptions = [
  "0-1 Years",
  "1-2 Years",
  "2-3 Years",
  "3-4 Years",
  "4-5 Years",
  "5-6 Years",
];

const templateOptions: { key: TemplateKey; label: string }[] = [
  { key: "0_2", label: "0-2 Years Template" },
  { key: "2_6", label: "2-6 Years Template" },
];

export default function ClassroomsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);

  const [selectedClassroom, setSelectedClassroom] =
    useState<ClassroomRow | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [classroomName, setClassroomName] = useState("");
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([]);
  const [selectedTemplateKeys, setSelectedTemplateKeys] = useState<TemplateKey[]>([]);

  const [teacherToAssign, setTeacherToAssign] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [moveLearnerToClassroomId, setMoveLearnerToClassroomId] = useState("");

  const [deleteTargetClassroom, setDeleteTargetClassroom] =
    useState<ClassroomRow | null>(null);
  const [moveAllTargetClassroomId, setMoveAllTargetClassroomId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
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
    await refreshAll(context.schoolId);
    setLoading(false);
  }

  async function refreshAll(currentSchoolId: number) {
    await Promise.all([
      fetchClassrooms(currentSchoolId),
      fetchLearners(currentSchoolId),
      fetchTeachers(currentSchoolId),
    ]);
  }

  async function fetchClassrooms(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("classrooms")
      .select("id, school_id, classroom_name, age_groups, stationery_templates, created_at")
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
      .select("id, name, class, classroom_id")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as LearnerRow[]);
  }

  async function fetchTeachers(currentSchoolId: number) {
    const response = await fetch("/api/list-teachers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        school_id: currentSchoolId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Could not load teachers.");
      return;
    }

    setTeachers(result.teachers || []);
  }

  function getClassroomName(room: ClassroomRow) {
    return room.classroom_name || "Unnamed classroom";
  }

  function getAgeGroupsLabel(room: ClassroomRow) {
    return room.age_groups && room.age_groups.length > 0
      ? room.age_groups.join(", ")
      : "No age groups";
  }

  function getRecommendedTemplates(ageGroups: string[]): TemplateKey[] {
    const hasZeroToTwo = ageGroups.some(
      (group) => group === "0-1 Years" || group === "1-2 Years"
    );

    const hasTwoToSix = ageGroups.some(
      (group) =>
        group === "2-3 Years" ||
        group === "3-4 Years" ||
        group === "4-5 Years" ||
        group === "5-6 Years"
    );

    if (hasZeroToTwo && hasTwoToSix) return ["0_2", "2_6"];
    if (hasZeroToTwo) return ["0_2"];
    if (hasTwoToSix) return ["2_6"];

    return [];
  }

  function getTemplateLabels(keys: TemplateKey[]) {
    if (keys.length === 0) return "No template assigned";

    return keys
      .map((key) =>
        key === "0_2" ? "0-2 Years Template" : "2-6 Years Template"
      )
      .join(" + ");
  }

  function getClassroomTemplateKeys(room: ClassroomRow) {
    if (room.stationery_templates && room.stationery_templates.length > 0) {
      return room.stationery_templates;
    }

    return getRecommendedTemplates(room.age_groups || []);
  }

  function resetForm() {
    setClassroomName("");
    setSelectedAgeGroups([]);
    setSelectedTemplateKeys([]);
    setEditingId(null);
  }

  function startEdit(room: ClassroomRow) {
    const currentAgeGroups = room.age_groups || [];
    const currentTemplates =
      room.stationery_templates && room.stationery_templates.length > 0
        ? room.stationery_templates
        : getRecommendedTemplates(currentAgeGroups);

    setEditingId(room.id);
    setClassroomName(getClassroomName(room));
    setSelectedAgeGroups(currentAgeGroups);
    setSelectedTemplateKeys(currentTemplates);
    setSelectedClassroom(room);
    setShowForm(true);
  }

  function handleAgeGroupToggle(group: string, checked: boolean) {
    const nextAgeGroups = checked
      ? [...selectedAgeGroups, group]
      : selectedAgeGroups.filter((item) => item !== group);

    setSelectedAgeGroups(nextAgeGroups);
    setSelectedTemplateKeys(getRecommendedTemplates(nextAgeGroups));
  }

  function toggleTemplateKey(key: TemplateKey, checked: boolean) {
    if (checked) {
      setSelectedTemplateKeys((prev) =>
        prev.includes(key) ? prev : [...prev, key]
      );
      return;
    }

    setSelectedTemplateKeys((prev) => prev.filter((item) => item !== key));
  }

  async function saveClassroom() {
    if (!schoolId) return;

    if (!classroomName.trim()) {
      alert("Please enter classroom name.");
      return;
    }

    if (selectedAgeGroups.length === 0) {
      alert("Please select at least one age group.");
      return;
    }

    if (selectedTemplateKeys.length === 0) {
      alert("Please select at least one stationery template.");
      return;
    }

    setSaving(true);

    if (editingId) {
      const oldClassroom = classrooms.find((room) => room.id === editingId);
      const oldName = oldClassroom ? getClassroomName(oldClassroom) : "";
      const newName = classroomName.trim();

      const { error } = await supabase
        .from("classrooms")
        .update({
          classroom_name: newName,
          age_groups: selectedAgeGroups,
          stationery_templates: selectedTemplateKeys,
        })
        .eq("id", editingId);

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }

      if (oldName && oldName !== newName) {
        await supabase
          .from("learners")
          .update({ class: newName })
          .eq("school_id", schoolId)
          .eq("class", oldName);

        await supabase
          .from("profiles")
          .update({ classroom_name: newName })
          .eq("school_id", schoolId)
          .eq("role", "teacher")
          .eq("classroom_name", oldName);
      }

      resetForm();
      setShowForm(false);
      await refreshAll(schoolId);

      setSelectedClassroom({
        id: editingId,
        school_id: schoolId,
        classroom_name: newName,
        age_groups: selectedAgeGroups,
        stationery_templates: selectedTemplateKeys,
      });

      setSaving(false);
      alert("Classroom updated.");
      return;
    }

    const { error } = await supabase.from("classrooms").insert([
      {
        school_id: schoolId,
        classroom_name: classroomName.trim(),
        age_groups: selectedAgeGroups,
        stationery_templates: selectedTemplateKeys,
      },
    ]);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    resetForm();
    setShowForm(false);
    await fetchClassrooms(schoolId);

    setSaving(false);
    alert("Classroom added.");
  }

  async function assignTeacherToClassroom() {
    if (!schoolId || !selectedClassroom || !teacherToAssign) {
      alert("Please select a teacher.");
      return;
    }

    const roomName = getClassroomName(selectedClassroom);

    const response = await fetch("/api/assign-classroom-teacher", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        school_id: schoolId,
        classroom_name: roomName,
        teacher_id: teacherToAssign,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Could not assign teacher.");
      return;
    }

    setTeacherToAssign("");
    await fetchTeachers(schoolId);

    alert("Teacher assigned.");
  }

  async function removeTeacherFromClassroom(teacherId: string) {
    if (!schoolId) return;

    const confirmed = confirm("Remove this teacher from this classroom?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("profiles")
      .update({ classroom_name: null })
      .eq("id", teacherId);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchTeachers(schoolId);
    alert("Teacher removed from classroom.");
  }

  async function moveLearnerToClassroom() {
    if (!schoolId || !selectedLearnerId || !moveLearnerToClassroomId) {
      alert("Please select a classroom to move the learner to.");
      return;
    }

    const targetRoom = classrooms.find(
      (room) => String(room.id) === String(moveLearnerToClassroomId)
    );

    if (!targetRoom) {
      alert("Classroom not found.");
      return;
    }

    const targetName = getClassroomName(targetRoom);

    const { error } = await supabase
      .from("learners")
      .update({
        class: targetName,
        classroom_id: targetRoom.id,
      })
      .eq("id", selectedLearnerId);

    if (error) {
      alert(error.message);
      return;
    }

    setSelectedLearnerId(null);
    setMoveLearnerToClassroomId("");

    await fetchLearners(schoolId);
    alert("Learner moved.");
  }

  function beginDeleteClassroom(room: ClassroomRow) {
    setDeleteTargetClassroom(room);
    setMoveAllTargetClassroomId("");
  }

  async function deleteClassroomDirectly(room: ClassroomRow) {
    if (!schoolId) return;

    const confirmed = confirm("Delete this classroom?");
    if (!confirmed) return;

    const { error } = await supabase.from("classrooms").delete().eq("id", room.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (selectedClassroom?.id === room.id) {
      setSelectedClassroom(null);
    }

    setDeleteTargetClassroom(null);
    await fetchClassrooms(schoolId);
    alert("Classroom deleted.");
  }

  async function moveAllLearnersThenDelete() {
    if (!schoolId || !deleteTargetClassroom || !moveAllTargetClassroomId) {
      alert("Please select the classroom where learners must be moved.");
      return;
    }

    const sourceName = getClassroomName(deleteTargetClassroom);

    const targetRoom = classrooms.find(
      (room) => String(room.id) === String(moveAllTargetClassroomId)
    );

    if (!targetRoom) {
      alert("Target classroom not found.");
      return;
    }

    const targetName = getClassroomName(targetRoom);

    const linkedTeachers = teachers.filter(
      (teacher) => teacher.classroom_name === sourceName
    );

    if (linkedTeachers.length > 0) {
      alert(
        "Please remove or reassign teachers from this classroom before deleting it."
      );
      return;
    }

    const { error: moveError } = await supabase
      .from("learners")
      .update({
        class: targetName,
        classroom_id: targetRoom.id,
      })
      .eq("school_id", schoolId)
      .or(`class.eq.${sourceName},classroom_id.eq.${deleteTargetClassroom.id}`);

    if (moveError) {
      alert(moveError.message);
      return;
    }

    const { error: deleteError } = await supabase
      .from("classrooms")
      .delete()
      .eq("id", deleteTargetClassroom.id);

    if (deleteError) {
      alert(deleteError.message);
      return;
    }

    if (selectedClassroom?.id === deleteTargetClassroom.id) {
      setSelectedClassroom(null);
    }

    setDeleteTargetClassroom(null);
    setMoveAllTargetClassroomId("");

    await refreshAll(schoolId);
    alert("Learners moved and classroom deleted.");
  }

  async function handleDeleteClassroom(room: ClassroomRow) {
    const roomName = getClassroomName(room);

    const hasLearners = learners.some(
      (learner) => learner.class === roomName || learner.classroom_id === room.id
    );

    const hasTeachers = teachers.some(
      (teacher) => teacher.classroom_name === roomName
    );

    if (hasTeachers) {
      alert(
        "This classroom has teachers assigned. Please remove or reassign teachers first."
      );
      return;
    }

    if (hasLearners) {
      beginDeleteClassroom(room);
      return;
    }

    await deleteClassroomDirectly(room);
  }

  const classroomStats = useMemo(() => {
    return classrooms.map((room) => {
      const roomName = getClassroomName(room);

      const learnerCount = learners.filter(
        (learner) => learner.class === roomName || learner.classroom_id === room.id
      ).length;

      const teacherCount = teachers.filter(
        (teacher) => teacher.classroom_name === roomName
      ).length;

      return {
        room,
        roomName,
        learnerCount,
        teacherCount,
      };
    });
  }, [classrooms, learners, teachers]);

  const selectedStats = selectedClassroom
    ? classroomStats.find((item) => item.room.id === selectedClassroom.id)
    : null;

  const selectedLearners = selectedStats
    ? learners.filter(
        (learner) =>
          learner.class === selectedStats.roomName ||
          learner.classroom_id === selectedStats.room.id
      )
    : [];

  const selectedTeachers = selectedStats
    ? teachers.filter((teacher) => teacher.classroom_name === selectedStats.roomName)
    : [];

  const availableTeachers = selectedStats
    ? teachers.filter((teacher) => teacher.classroom_name !== selectedStats.roomName)
    : teachers;

  const selectedLearner = selectedLearnerId
    ? learners.find((learner) => String(learner.id) === String(selectedLearnerId))
    : null;

  if (loading) {
    return <p>Loading classrooms...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <div style={topHeader}>
          <div>
            <h2 className="db-page-title">Classrooms</h2>
            <p className="db-page-subtitle">
              Manage classrooms, age groups, assigned teachers, and learner placement.
            </p>

            {schoolParam && schoolId ? (
              <Link href={`/master/school/${schoolId}`} style={backButton}>
                Back to School Overview
              </Link>
            ) : null}
          </div>

          <button
            type="button"
            className="db-button-primary"
            onClick={() => {
              resetForm();
              setShowForm((prev) => !prev);
            }}
          >
            {showForm ? "Close" : "Add Classroom"}
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
          <h3 style={sectionTitle}>
            {editingId ? "Edit Classroom" : "Add Classroom"}
          </h3>

          <div style={grid2}>
            <div>
              <p style={labelText}>Classroom Name</p>
              <input
                className="db-input"
                value={classroomName}
                onChange={(e) => setClassroomName(e.target.value)}
                placeholder="Dolphins, Butterflies, Cubs..."
              />
            </div>

            <div style={ageGroupBox}>
              <p style={ageGroupTitle}>Select Age Groups</p>

              <div style={checkboxGrid}>
                {ageGroupOptions.map((group) => (
                  <label key={group} style={checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={selectedAgeGroups.includes(group)}
                      onChange={(e) =>
                        handleAgeGroupToggle(group, e.target.checked)
                      }
                    />
                    {group}
                  </label>
                ))}
              </div>

              {selectedAgeGroups.length > 0 ? (
                <div style={templateBox}>
                  <strong>Assigned Stationery Templates</strong>
                  <p style={smallText}>{getTemplateLabels(selectedTemplateKeys)}</p>

                  <div style={{ marginTop: 10 }}>
                    <strong>Manual Template Selection</strong>

                    <div style={templateCheckboxGrid}>
                      {templateOptions.map((template) => (
                        <label key={template.key} style={checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={selectedTemplateKeys.includes(template.key)}
                            onChange={(e) =>
                              toggleTemplateKey(template.key, e.target.checked)
                            }
                          />
                          {template.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <strong style={{ display: "block", marginTop: 10 }}>
                    Assigned Documents Template
                  </strong>
                  <p style={smallText}>Required Learner Documents</p>
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            className="db-button-primary"
            onClick={saveClassroom}
            disabled={saving}
            style={{ width: "100%", marginTop: 12 }}
          >
            {saving
              ? "Saving..."
              : editingId
              ? "Update Classroom"
              : "Save Classroom"}
          </button>
        </div>
      ) : null}

      {deleteTargetClassroom ? (
        <div className="db-card db-card-yellow" style={{ padding: 16, marginBottom: 18 }}>
          <h3 style={sectionTitle}>Move Learners Before Deleting</h3>

          <p style={smallText}>
            {getClassroomName(deleteTargetClassroom)} has learners.
            Choose another classroom before deleting it.
          </p>

          <div style={actionGrid}>
            <select
              className="db-input"
              value={moveAllTargetClassroomId}
              onChange={(e) => setMoveAllTargetClassroomId(e.target.value)}
            >
              <option value="">Move learners to...</option>
              {classrooms
                .filter((room) => room.id !== deleteTargetClassroom.id)
                .map((room) => (
                  <option key={room.id} value={room.id}>
                    {getClassroomName(room)}
                  </option>
                ))}
            </select>

            <button
              type="button"
              className="db-button-secondary"
              onClick={moveAllLearnersThenDelete}
            >
              Move & Delete
            </button>
          </div>

          <button
            type="button"
            className="db-button-secondary"
            onClick={() => {
              setDeleteTargetClassroom(null);
              setMoveAllTargetClassroomId("");
            }}
            style={{ marginTop: 10 }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div className="db-card db-card-green" style={{ padding: 16 }}>
        <h3 style={sectionTitle}>Classrooms ({classrooms.length})</h3>

        {classrooms.length === 0 ? (
          <p className="db-helper">No classrooms added yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {classroomStats.map((item) => {
              const active = selectedClassroom?.id === item.room.id;
              const roomTemplateKeys = getClassroomTemplateKeys(item.room);

              return (
                <div key={item.room.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClassroom(active ? null : item.room);
                      setSelectedLearnerId(null);
                      setMoveLearnerToClassroomId("");
                      setTeacherToAssign("");
                    }}
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "1fr 210px 110px 110px",
                      gap: 8,
                      alignItems: "center",
                      background: active ? "#EAF7FD" : "#FFFDFB",
                      border: active
                        ? "1px solid #CBEAF7"
                        : "1px solid #F0E3D8",
                      borderRadius: 12,
                      padding: "10px 12px",
                      color: "#2D2A3E",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <strong>{item.roomName}</strong>
                    <span style={pillAge}>{getAgeGroupsLabel(item.room)}</span>
                    <span style={pillBlue}>{item.learnerCount} learners</span>
                    <span style={pillNeutral}>{item.teacherCount} teachers</span>
                  </button>

                  {active && selectedStats ? (
                    <div style={expandedCard}>
                      <h3 style={sectionTitle}>{selectedStats.roomName}</h3>

                      <p style={smallText}>
                        Age groups: {getAgeGroupsLabel(selectedStats.room)}
                      </p>

                      <div style={miniGrid}>
                        <MiniBlock label="Learners" value={selectedStats.learnerCount} />
                        <MiniBlock label="Teachers" value={selectedStats.teacherCount} />
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <p style={labelText}>Assigned Templates</p>

                        <div style={compactRowWithAction}>
                          <span>
                            Stationery: {getTemplateLabels(roomTemplateKeys)}
                          </span>
                        </div>

                        <div style={{ ...compactRowWithAction, marginTop: 6 }}>
                          <span>Documents: Required Learner Documents</span>
                        </div>
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <p style={labelText}>Assign Teacher</p>

                        <div style={actionGrid}>
                          <select
                            className="db-input"
                            value={teacherToAssign}
                            onChange={(e) => setTeacherToAssign(e.target.value)}
                          >
                            <option value="">Select teacher</option>
                            {availableTeachers.map((teacher) => (
                              <option key={teacher.id} value={teacher.id}>
                                {teacher.full_name || teacher.email || "Unnamed teacher"}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            className="db-button-secondary"
                            onClick={assignTeacherToClassroom}
                          >
                            Assign
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <p style={labelText}>Assigned Teachers</p>

                        {selectedTeachers.length === 0 ? (
                          <p className="db-helper">No teacher assigned.</p>
                        ) : (
                          <div style={{ display: "grid", gap: 6 }}>
                            {selectedTeachers.map((teacher) => (
                              <div key={teacher.id} style={compactRowWithAction}>
                                <span>{teacher.full_name || "Unnamed teacher"}</span>

                                <button
                                  type="button"
                                  className="db-button-secondary"
                                  onClick={() => removeTeacherFromClassroom(teacher.id)}
                                  style={{ minHeight: 32, padding: "6px 10px" }}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <p style={labelText}>Learners</p>

                        {selectedLearners.length === 0 ? (
                          <p className="db-helper">No learners in this classroom.</p>
                        ) : (
                          <div style={{ display: "grid", gap: 6 }}>
                            {selectedLearners.map((learner) => {
                              const learnerActive =
                                String(selectedLearnerId) === String(learner.id);

                              return (
                                <button
                                  key={learner.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedLearnerId(
                                      learnerActive ? null : String(learner.id)
                                    );
                                    setMoveLearnerToClassroomId("");
                                  }}
                                  style={{
                                    ...compactButton,
                                    background: learnerActive ? "#EAF7FD" : "#FFFFFF",
                                  }}
                                >
                                  {learner.name || "Unnamed learner"}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {selectedLearner ? (
                        <div style={moveBox}>
                          <p style={labelText}>
                            Move {selectedLearner.name || "learner"} to another classroom
                          </p>

                          <div style={actionGrid}>
                            <select
                              className="db-input"
                              value={moveLearnerToClassroomId}
                              onChange={(e) =>
                                setMoveLearnerToClassroomId(e.target.value)
                              }
                            >
                              <option value="">Select classroom</option>
                              {classrooms
                                .filter((room) => room.id !== selectedClassroom.id)
                                .map((room) => (
                                  <option key={room.id} value={room.id}>
                                    {getClassroomName(room)}
                                  </option>
                                ))}
                            </select>

                            <button
                              type="button"
                              className="db-button-secondary"
                              onClick={moveLearnerToClassroom}
                            >
                              Save Move
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div style={footerActions}>
                        <button
                          type="button"
                          className="db-button-secondary"
                          onClick={() => startEdit(selectedStats.room)}
                        >
                          Edit Classroom
                        </button>

                        <button
                          type="button"
                          className="db-button-secondary"
                          onClick={() => handleDeleteClassroom(selectedStats.room)}
                        >
                          Delete Classroom
                        </button>
                      </div>
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

function MiniBlock({ label, value }: { label: string; value: number }) {
  return (
    <div style={miniBlock}>
      <p style={smallText}>{label}</p>
      <strong style={{ color: "#2D2A3E", fontSize: 20 }}>{value}</strong>
    </div>
  );
}

const topHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap" as const,
};

const sectionTitle = {
  margin: "0 0 10px 0",
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 700 as const,
};

const labelText = {
  margin: "0 0 8px 0",
  color: "#6D6888",
  fontSize: 13,
  fontWeight: 800,
};

const smallText = {
  margin: "4px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
};

const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 14,
};

const ageGroupBox = {
  border: "1px solid #ddd",
  borderRadius: "12px",
  padding: "14px",
  background: "#fff",
};

const ageGroupTitle = {
  fontWeight: 700,
  margin: "0 0 10px 0",
  color: "#333",
};

const checkboxGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "10px",
};

const templateCheckboxGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "8px",
  marginTop: 8,
};

const checkboxLabel = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
};

const templateBox = {
  marginTop: 12,
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: 12,
};

const miniGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 8,
  marginTop: 12,
};

const miniBlock = {
  background: "#FFFFFF",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: 10,
};

const actionGrid = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 8,
  alignItems: "center",
};

const compactRowWithAction = {
  background: "#FFFFFF",
  border: "1px solid #F0E3D8",
  borderRadius: 10,
  padding: "8px 10px",
  color: "#2D2A3E",
  fontSize: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
};

const compactButton = {
  width: "100%",
  border: "1px solid #F0E3D8",
  borderRadius: 10,
  padding: "8px 10px",
  color: "#2D2A3E",
  fontSize: 14,
  textAlign: "left" as const,
  cursor: "pointer",
};

const expandedCard = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: 12,
  marginTop: 8,
};

const moveBox = {
  marginTop: 12,
  background: "#FFFFFF",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: 12,
};

const footerActions = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap" as const,
  marginTop: 12,
};

const pillAge = {
  background: "#FFF7D9",
  border: "1px solid #F3E4A3",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  textAlign: "center" as const,
};

const pillBlue = {
  background: "#EAF7FD",
  border: "1px solid #CBEAF7",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  textAlign: "center" as const,
};

const pillNeutral = {
  background: "#F8F4FF",
  border: "1px solid #E7DFF8",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  textAlign: "center" as const,
};

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