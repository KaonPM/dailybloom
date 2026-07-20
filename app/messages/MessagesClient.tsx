"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { getCurrentProfile } from "@/app/lib/auth";

type Mode = "staff" | "parent";
type UserRole = "parent" | "teacher" | "principal" | "master";
type ContactRole = "parent" | "teacher" | "principal";

type SchoolRelation =
  | { id?: number | null; school_name?: string | null }
  | { id?: number | null; school_name?: string | null }[]
  | null;

type ClassroomRelation =
  | { classroom_name?: string | null; teacher_name?: string | null }
  | { classroom_name?: string | null; teacher_name?: string | null }[]
  | null;

type Child = {
  id: string;
  name?: string | null;
  school_id?: number | null;
  schools?: SchoolRelation;
  classrooms?: ClassroomRelation;
};

type StaffDirectoryRow = {
  id: string;
  full_name?: string | null;
  role?: string | null;
  school_id?: number | null;
  classroom_name?: string | null;
};

type InitialParent = {
  phone?: string | null;
  name?: string | null;
  children: Child[];
  schoolStaff?: StaffDirectoryRow[];
} | null;

type StaffProfile = StaffDirectoryRow & {
  school_id: number;
};

type LearnerOption = {
  id: string;
  name: string;
  parent_name?: string | null;
  parent_phone?: string | null;
  class?: string | null;
  classroom_id?: number | null;
  classrooms?:
    | {
        classroom_name?: string | null;
      }
    | {
        classroom_name?: string | null;
      }[]
    | null;
};

type TeacherOption = {
  id: string;
  full_name?: string | null;
  classroom_name?: string | null;
};

type PrincipalOption = {
  id: string;
  full_name?: string | null;
  role?: string | null;
  school_id?: number | null;
  classroom_name?: string | null;
};

type Contact = {
  id: string;
  name: string;
  role: ContactRole;
  learner_id?: string | null;
  learner_name?: string | null;
  classroom_name?: string | null;
  subtitle?: string;
};

type MessageRow = {
  id: number;
  school_id: number;
  learner_id?: string | null;
  sender_role: string;
  sender_id?: string | null;
  sender_name?: string | null;
  recipient_role: string;
  recipient_id?: string | null;
  recipient_name?: string | null;
  message: string;
  is_read?: boolean | null;
  created_at?: string | null;
};

export default function MessagesClient({
  initialParent,
  mode = "staff",
}: {
  initialParent: InitialParent;
  mode?: Mode;
}) {
  const searchParams = useSearchParams();
  const messageFetch = initialParent ? fetch : authenticatedFetch;
  const [role, setRole] = useState<UserRole | "">("");
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");

  const [parentChildren, setParentChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");

  const [principalContacts, setPrincipalContacts] = useState<Contact[]>([]);
  const [teacherContacts, setTeacherContacts] = useState<Contact[]>([]);

  const [teacherLearners, setTeacherLearners] = useState<LearnerOption[]>([]);
  const [principalLearners, setPrincipalLearners] = useState<LearnerOption[]>([]);
  const [selectedTeacherLearnerId, setSelectedTeacherLearnerId] = useState("");
  const [selectedClassroomName, setSelectedClassroomName] = useState("");
  const [selectedPrincipalLearnerId, setSelectedPrincipalLearnerId] = useState("");

  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});
  const [newMessage, setNewMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const selectedChild = useMemo(() => {
    return (
      parentChildren.find((child) => String(child.id) === selectedChildId) ||
      parentChildren[0] ||
      null
    );
  }, [parentChildren, selectedChildId]);

  const classroomNames = useMemo(() => {
    const names = principalLearners
      .map((learner) => getLearnerClassroomName(learner))
      .filter(Boolean) as string[];

    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [principalLearners]);

  const filteredPrincipalLearners = useMemo(() => {
    return principalLearners.filter((learner) => {
      if (!selectedClassroomName) return true;
      return getLearnerClassroomName(learner) === selectedClassroomName;
    });
  }, [principalLearners, selectedClassroomName]);

  const selectedTeacherLearner = useMemo(() => {
    return teacherLearners.find(
      (learner) => String(learner.id) === selectedTeacherLearnerId
    );
  }, [teacherLearners, selectedTeacherLearnerId]);

  const selectedPrincipalLearner = useMemo(() => {
    return filteredPrincipalLearners.find(
      (learner) => String(learner.id) === selectedPrincipalLearnerId
    );
  }, [filteredPrincipalLearners, selectedPrincipalLearnerId]);

  useEffect(() => {
    loadMessagesPage();
  }, []);

  useEffect(() => {
    function updateLayoutMode() {
      setIsMobile(window.innerWidth < 760);
    }

    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);

    return () => {
      window.removeEventListener("resize", updateLayoutMode);
    };
  }, []);

  useEffect(() => {
    if (mode === "parent" && selectedChild) {
      buildParentContacts(selectedChild);
    }
  }, [selectedChildId]);

  useEffect(() => {
    if (role === "teacher" && selectedTeacherLearner) {
      setActiveContact(buildParentContactFromLearner(selectedTeacherLearner));
    }
  }, [selectedTeacherLearnerId]);

  useEffect(() => {
    if ((role === "principal" || role === "master") && selectedPrincipalLearner) {
      setActiveContact(buildParentContactFromLearner(selectedPrincipalLearner));
    }
  }, [selectedPrincipalLearnerId]);

  useEffect(() => {
    if (activeContact) {
      fetchConversation(activeContact);
    } else {
      setMessages([]);
    }
  }, [activeContact?.id, activeContact?.learner_id, schoolId, currentUserId]);

  useEffect(() => {
    fetchUnreadConversationCounts();
  }, [schoolId, currentUserId]);

  useEffect(() => {
    if (!schoolId || !currentUserId || !activeContact) return;

    const channel = supabase
      .channel(
        `messages-${schoolId}-${currentUserId}-${activeContact.id}-${activeContact.learner_id || "general"}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const nextMessage = payload.new as MessageRow | null;

          if (!nextMessage || Number(nextMessage.school_id) !== schoolId) return;
          if (!messageBelongsToContact(nextMessage, activeContact)) return;

          setMessages((current) => {
            const withoutDuplicate = current.filter(
              (message) => message.id !== nextMessage.id
            );

            return [...withoutDuplicate, nextMessage].sort((a, b) =>
              String(a.created_at || "").localeCompare(String(b.created_at || ""))
            );
          });
          fetchUnreadConversationCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeContact?.id, activeContact?.learner_id, schoolId, currentUserId]);

  async function loadMessagesPage() {
    if (mode === "parent") {
      await loadParentContext();
      return;
    }

    await loadStaffContext();
  }

  async function loadParentContext() {
    if (!initialParent) {
      setLoading(false);
      return;
    }

    const children = initialParent.children || [];
    const firstChild = children[0];

    if (!firstChild) {
      setLoading(false);
      return;
    }

    const school = Array.isArray(firstChild.schools)
      ? firstChild.schools[0]
      : firstChild.schools;

    setRole("parent");
    setParentChildren(children);
    setSelectedChildId(String(firstChild.id));
    setSchoolId(Number(firstChild.school_id || school?.id));
    setCurrentUserId(String(initialParent.phone));
    setCurrentUserName(String(initialParent.name || "Parent"));

    await buildParentContacts(firstChild);

    setLoading(false);
  }

  async function loadStaffContext() {
    const { profile } = await getCurrentProfile();

    if (!profile) {
      setLoading(false);
      return;
    }

    const profileRole = String(profile.role || "") as UserRole;

    setRole(profileRole);
    setSchoolId(Number(profile.school_id));
    setCurrentUserId(String(profile.id));
    setCurrentUserName(String(profile.full_name || "User"));

    if (profileRole === "teacher") {
      await loadTeacherView(profile);
    } else {
      await loadPrincipalView(profile);
    }

    setLoading(false);
  }

  async function buildParentContacts(child: Child) {
    const school = Array.isArray(child.schools) ? child.schools[0] : child.schools;
    const classroom = Array.isArray(child.classrooms)
      ? child.classrooms[0]
      : child.classrooms;

    const currentSchoolId = Number(child.school_id || school?.id);
    const contacts: Contact[] = [];
    const serverStaff = (initialParent?.schoolStaff || []).filter(
      (staff) => Number(staff.school_id) === currentSchoolId
    );

    if (classroom?.teacher_name) {
      const serverTeacher = serverStaff.find((staff) =>
        String(staff.role) === "teacher" &&
        (String(staff.classroom_name || "") === String(classroom.classroom_name || "") ||
          String(staff.full_name || "") === String(classroom.teacher_name || ""))
      );
      const { data: teachers } = serverTeacher ? { data: [serverTeacher] } : await supabase
        .from("profiles")
        .select("id, full_name, role, classroom_name")
        .eq("school_id", currentSchoolId)
        .eq("role", "teacher")
        .eq("classroom_name", classroom.classroom_name)
        .limit(1);

      const teacher = teachers?.[0];
      const teacherId = String(teacher?.id || classroom.teacher_name);

      contacts.push({
        id: teacherId,
        name: String(teacher?.full_name || classroom.teacher_name),
        role: "teacher",
        learner_id: child.id,
        learner_name: child.name,
        classroom_name: classroom?.classroom_name || null,
        subtitle: `${classroom?.classroom_name || "Class"} teacher`,
      });
    }

    const serverPrincipals = serverStaff.filter(
      (staff) => ["principal", "master", "owner", "admin"].includes(String(staff.role))
    );

    const { data: fetchedPrincipals } = serverPrincipals.length
      ? { data: serverPrincipals }
      : await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("school_id", currentSchoolId)
      .in("role", ["principal", "master", "owner", "admin"])
      .limit(5);

    ((fetchedPrincipals || []) as PrincipalOption[]).forEach((principal) => {
      contacts.push({
        id: String(principal.id),
        name: String(principal.full_name || "School Principal"),
        role: "principal",
        learner_id: child.id,
        learner_name: child.name,
        classroom_name: classroom?.classroom_name || null,
        subtitle: "School principal",
      });
    });

    if (contacts.length > 0) {
      const requestedContactId = searchParams.get("contact");
      const requestedLearnerId = searchParams.get("learner");
      const requestedContact = contacts.find((contact) =>
        (!requestedContactId || String(contact.id) === requestedContactId) &&
        (!requestedLearnerId || String(contact.learner_id || "") === requestedLearnerId)
      );
      setActiveContact(requestedContact || contacts[0]);
    } else {
      setActiveContact(null);
    }

    setPrincipalContacts(contacts.filter((contact) => contact.role === "principal"));
    setTeacherContacts(contacts.filter((contact) => contact.role === "teacher"));
  }

  function getConversationKey(contactId: string, learnerId?: string | null) {
    return `${contactId}::${learnerId || ""}`;
  }

  async function fetchUnreadConversationCounts() {
    if (!schoolId || !currentUserId) return;

    const response = await messageFetch("/api/messages/unread", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        school_id: schoolId,
        recipient_id: currentUserId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return;
    }

    setUnreadByConversation(result.counts || {});
  }

  async function fetchStaffDirectory(currentSchoolId: number) {
    const response = await messageFetch("/api/messages/staff-directory", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ school_id: currentSchoolId }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not load message contacts.");
    }

    return {
      teachers: (result.teachers || []) as TeacherOption[],
      principals: (result.principals || []) as PrincipalOption[],
    };
  }

  async function loadTeacherView(profile: StaffProfile) {
    const currentSchoolId = Number(profile.school_id);
    const classroomName = String(profile.classroom_name || "");

    const { principals } = await fetchStaffDirectory(currentSchoolId);

    const principalList: Contact[] = (principals || [])
      .filter((principal) => String(principal.id) !== String(profile.id))
      .map((principal) => ({
      id: String(principal.id),
      name: String(principal.full_name || "School Principal"),
      role: "principal",
      learner_id: null,
      subtitle: "School principal",
    }));

    const { data: learners } = await supabase
      .from("learners")
      .select(
        `
          id,
          name,
          parent_name,
          parent_phone,
          class,
          classroom_id,
          classrooms:classroom_id(
            classroom_name
          )
        `
      )
      .eq("school_id", currentSchoolId)
      .eq("class", classroomName)
      .order("name", { ascending: true });

    const learnerRows = (learners || []) as LearnerOption[];

    setPrincipalContacts(principalList);
    setTeacherLearners(learnerRows);

    if (principalList[0]) {
      setActiveContact(principalList[0]);
    } else if (learnerRows[0]) {
      setSelectedTeacherLearnerId(String(learnerRows[0].id));
      setActiveContact(buildParentContactFromLearner(learnerRows[0]));
    } else {
      setActiveContact(null);
    }
  }

  async function loadPrincipalView(profile: StaffProfile) {
    const currentSchoolId = Number(profile.school_id);

    const { teachers } = await fetchStaffDirectory(currentSchoolId);

    const teacherList: Contact[] = ((teachers || []) as TeacherOption[]).map(
      (teacher) => ({
        id: String(teacher.id),
        name: String(teacher.full_name || "Teacher"),
        role: "teacher",
        learner_id: null,
        classroom_name: teacher.classroom_name || null,
        subtitle: teacher.classroom_name
          ? `${teacher.classroom_name} teacher`
          : "Teacher",
      })
    );

    const { data: learners } = await supabase
      .from("learners")
      .select(
        `
          id,
          name,
          parent_name,
          parent_phone,
          class,
          classroom_id,
          classrooms:classroom_id(
            classroom_name
          )
        `
      )
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    const learnerRows = (learners || []) as LearnerOption[];
    const classes = [
      ...new Set(
        learnerRows
          .map((learner) => getLearnerClassroomName(learner))
          .filter(Boolean) as string[]
      ),
    ].sort((a, b) => a.localeCompare(b));

    setTeacherContacts(teacherList);
    setPrincipalLearners(learnerRows);
    setSelectedClassroomName(classes[0] || "");

    const firstLearner =
      learnerRows.find(
        (learner) => getLearnerClassroomName(learner) === classes[0]
      ) || learnerRows[0];

    if (teacherList[0]) {
      setActiveContact(teacherList[0]);
    } else if (firstLearner) {
      setSelectedPrincipalLearnerId(String(firstLearner.id));
      setActiveContact(buildParentContactFromLearner(firstLearner));
    } else {
      setActiveContact(null);
    }
  }

  function buildParentContactFromLearner(learner: LearnerOption): Contact {
    return {
      id: String(learner.parent_phone || ""),
      name: String(learner.parent_name || `Parent of ${learner.name}`),
      role: "parent",
      learner_id: learner.id,
      learner_name: learner.name,
      classroom_name: getLearnerClassroomName(learner),
      subtitle: `Parent of ${learner.name}`,
    };
  }

  async function fetchConversation(contact: Contact) {
    if (!schoolId || !currentUserId) return;

    const response = await messageFetch("/api/messages/conversation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        school_id: schoolId,
        current_user_id: currentUserId,
        contact_id: contact.id,
        learner_id: contact.learner_id || null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Could not load conversation.");
      return;
    }

    setMessages((result.messages || []) as MessageRow[]);
    fetchUnreadConversationCounts();
  }

  function messageBelongsToContact(message: MessageRow, contact: Contact) {
    const sentByMe =
      String(message.sender_id) === currentUserId &&
      String(message.recipient_id) === contact.id;

    const sentToMe =
      String(message.sender_id) === contact.id &&
      String(message.recipient_id) === currentUserId;

    const sameLearner = contact.learner_id
      ? String(message.learner_id || "") === String(contact.learner_id)
      : true;

    return (sentByMe || sentToMe) && sameLearner;
  }

  async function sendMessage() {
    if (!schoolId || !activeContact || !newMessage.trim()) return;

    if (activeContact.role === "parent" && !activeContact.id) {
      alert("This learner does not have a parent contact number.");
      return;
    }

    setSending(true);

    try {
      const response = await messageFetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          school_id: schoolId,
          learner_id: activeContact.learner_id || null,
          sender_role: role,
          sender_id: currentUserId,
          sender_name: currentUserName,
          recipient_role: activeContact.role,
          recipient_id: activeContact.id,
          recipient_name: activeContact.name,
          message: newMessage.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Could not send message.");
        return;
      }

      setNewMessage("");

      if (result.message) {
        setMessages((current) => {
          const withoutDuplicate = current.filter(
            (message) => message.id !== result.message.id
          );

          return [...withoutDuplicate, result.message].sort((a, b) =>
            String(a.created_at || "").localeCompare(String(b.created_at || ""))
          );
        });
      }

      fetchConversation(activeContact).catch((error) => {
        console.error("Conversation refresh failed:", error);
      });
      fetchUnreadConversationCounts();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  function handleTeacherLearnerChange(value: string) {
    setSelectedTeacherLearnerId(value);

    const learner = teacherLearners.find((item) => String(item.id) === value);

    if (learner) {
      setActiveContact(buildParentContactFromLearner(learner));
    }
  }

  function handlePrincipalClassChange(value: string) {
    setSelectedClassroomName(value);

    const learner = principalLearners.find(
      (item) => getLearnerClassroomName(item) === value
    );

    if (learner) {
      setSelectedPrincipalLearnerId(String(learner.id));
      setActiveContact(buildParentContactFromLearner(learner));
    } else {
      setSelectedPrincipalLearnerId("");
      setActiveContact(null);
    }
  }

  function handlePrincipalLearnerChange(value: string) {
    setSelectedPrincipalLearnerId(value);

    const learner = principalLearners.find((item) => String(item.id) === value);

    if (learner) {
      setActiveContact(buildParentContactFromLearner(learner));
    }
  }

  function getLearnerClassroomName(learner: LearnerOption) {
    const classroom = Array.isArray(learner.classrooms)
      ? learner.classrooms[0]
      : learner.classrooms;

    return classroom?.classroom_name || learner.class || "";
  }

  function getRoleLabel(value?: string | null) {
    if (value === "parent") return "Parent";
    if (value === "teacher") return "Teacher";
    if (value === "principal") return "Principal";
    if (value === "master") return "Principal";
    if (value === "owner") return "Principal";

    return value || "";
  }

  function formatMessageTime(dateValue?: string | null) {
    if (!dateValue) return "";

    return new Date(dateValue).toLocaleString("en-ZA", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderParentSidebar() {
    return (
      <>
        <h3 style={sectionTitle}>Messages</h3>

        {parentChildren.length > 1 ? (
          <div style={groupBox}>
            <p style={groupTitle}>Child</p>
            <select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              style={selectStyle}
            >
              {parentChildren.map((child) => (
                <option key={child.id} value={String(child.id)}>
                  {child.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {teacherContacts.length > 0 ? (
          <div style={groupBox}>
            <p style={groupTitle}>Teacher</p>
            {teacherContacts.map((contact) => renderContactButton(contact))}
          </div>
        ) : null}

        {principalContacts.length > 0 ? (
          <div style={groupBox}>
            <p style={groupTitle}>Principal</p>
            {principalContacts.map((contact) => renderContactButton(contact))}
          </div>
        ) : null}
      </>
    );
  }

  function renderTeacherSidebar() {
    return (
      <>
        <h3 style={sectionTitle}>Messages</h3>

        {principalContacts.length > 0 ? (
          <div style={groupBox}>
            <p style={groupTitle}>Principal</p>
            {principalContacts.map((contact) => renderContactButton(contact))}
          </div>
        ) : null}

        <div style={groupBox}>
          <p style={groupTitle}>Parents</p>

          <label style={labelText}>Select learner</label>
          <select
            value={selectedTeacherLearnerId}
            onChange={(e) => handleTeacherLearnerChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">Choose learner</option>
            {teacherLearners.map((learner) => (
              <option key={learner.id} value={String(learner.id)}>
                {learner.name}
              </option>
            ))}
          </select>

          {selectedTeacherLearner ? (
            <div style={selectedInfoBox}>
              <p style={smallText}>
                Parent: {selectedTeacherLearner.parent_name || "Parent"}
              </p>
            </div>
          ) : (
            <p style={smallText}>Choose a learner to message their parent.</p>
          )}
        </div>
      </>
    );
  }

  function renderPrincipalSidebar() {
    return (
      <>
        <h3 style={sectionTitle}>Messages</h3>

        {teacherContacts.length > 0 ? (
          <div style={groupBox}>
            <p style={groupTitle}>Teachers</p>
            <div style={{ display: "grid", gap: 8 }}>
              {teacherContacts.map((contact) => renderContactButton(contact))}
            </div>
          </div>
        ) : null}

        <div style={groupBox}>
          <p style={groupTitle}>Parents</p>

          <label style={labelText}>Select class</label>
          <select
            value={selectedClassroomName}
            onChange={(e) => handlePrincipalClassChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">All classes</option>
            {classroomNames.map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>

          <label style={{ ...labelText, marginTop: 10 }}>Select learner</label>
          <select
            value={selectedPrincipalLearnerId}
            onChange={(e) => handlePrincipalLearnerChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">Choose learner</option>
            {filteredPrincipalLearners.map((learner) => (
              <option key={learner.id} value={String(learner.id)}>
                {learner.name}
              </option>
            ))}
          </select>

          {selectedPrincipalLearner ? (
            <div style={selectedInfoBox}>
              <p style={smallText}>
                Parent: {selectedPrincipalLearner.parent_name || "Parent"}
              </p>
            </div>
          ) : (
            <p style={smallText}>Choose a learner to message their parent.</p>
          )}
        </div>
      </>
    );
  }

  function renderContactButton(contact: Contact) {
    const active =
      activeContact?.id === contact.id &&
      String(activeContact?.learner_id || "") === String(contact.learner_id || "");
    const unreadCount =
      unreadByConversation[getConversationKey(contact.id, contact.learner_id)] || 0;

    return (
      <button
        key={`${contact.role}-${contact.id}-${contact.learner_id || ""}`}
        type="button"
        onClick={() => setActiveContact(contact)}
        style={{
          ...contactButton,
          background: active ? "#EAF7FD" : "#FFFDFB",
          border: active ? "1px solid #CBEAF7" : "1px solid #F0E3D8",
        }}
      >
        <span style={contactTitleRow}>
          <strong>{contact.name}</strong>
          {unreadCount > 0 ? <span style={contactUnreadBadge}>{unreadCount}</span> : null}
        </span>
        <span style={smallText}>{contact.subtitle}</span>
      </button>
    );
  }

  if (loading) {
    return <p>Loading messages...</p>;
  }

  return (
    <div style={pageShell}>
      <div
        className="db-soft-card"
        style={{
          padding: isMobile ? 14 : 18,
          marginBottom: isMobile ? 12 : 18,
        }}
      >
        <div style={{ ...pageHeader, ...(isMobile ? mobilePageHeader : {}) }}>
          <div>
            <h2 className="db-page-title">Messages</h2>
            <p className="db-page-subtitle">
              Send and receive messages with parents, teachers and the principal.
            </p>
          </div>

          <Link
            href={
              mode === "parent"
                ? "/parent/dashboard"
                : role === "teacher"
                  ? "/teacher"
                  : "/dashboard"
            }
            style={{ ...backLink, ...(isMobile ? mobileBackLink : {}) }}
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      <div style={{ ...layout, ...(isMobile ? mobileLayout : {}) }}>
        <div
          className="db-card db-card-lavender"
          style={{ ...sidebar, ...(isMobile ? mobileSidebar : {}) }}
        >
          {mode === "parent"
            ? renderParentSidebar()
            : role === "teacher"
              ? renderTeacherSidebar()
              : renderPrincipalSidebar()}
        </div>

        <div
          className="db-card db-card-blue"
          style={{ ...chatPanel, ...(isMobile ? mobileChatPanel : {}) }}
        >
          {!activeContact ? (
            <p className="db-helper">Select a conversation.</p>
          ) : (
            <>
              <div style={{ ...chatHeader, ...(isMobile ? mobileChatHeader : {}) }}>
                <div>
                  <h3 style={sectionTitle}>{activeContact.name}</h3>

                  {activeContact.subtitle ? (
                    <p style={smallText}>{activeContact.subtitle}</p>
                  ) : null}

                </div>

                <span style={rolePill}>{getRoleLabel(activeContact.role)}</span>
              </div>

              <div style={{ ...messageList, ...(isMobile ? mobileMessageList : {}) }}>
                {messages.length === 0 ? (
                  <div style={emptyConversation}>
                    <strong>No messages yet.</strong>
                    <p style={{ margin: "6px 0 0" }}>Say hello.</p>
                    <p style={{ margin: "6px 0 0" }}>
                      This conversation is private between you and this contact.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const mine = String(message.sender_id) === currentUserId;

                    return (
                      <div
                        key={message.id}
                        style={{
                          ...messageBubble,
                          ...(isMobile ? mobileMessageBubble : {}),
                          alignSelf: mine ? "flex-end" : "flex-start",
                          background: mine ? "#E8F7EE" : "#FFFFFF",
                        }}
                      >
                        <strong>{mine ? "You" : message.sender_name}</strong>
                        <p style={{ margin: "6px 0 0" }}>{message.message}</p>
                        <span style={timeText}>
                          {formatMessageTime(message.created_at)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ ...replyBox, ...(isMobile ? mobileReplyBox : {}) }}>
                <textarea
                  className="db-input"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={3}
                  style={{
                    resize: "vertical",
                    flex: 1,
                    minWidth: 0,
                    width: "100%",
                  }}
                />

                <button
                  type="button"
                  className="db-button-primary"
                  onClick={sendMessage}
                  disabled={sending}
                  style={{ ...sendButton, ...(isMobile ? mobileSendButton : {}) }}
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const pageShell = {
  width: "100%",
  maxWidth: "100%",
  overflow: "hidden",
} as const;

const layout = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
  gap: 18,
  width: "100%",
  maxWidth: "100%",
} as const;

const mobileLayout = {
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 12,
} as const;

const sidebar = {
  padding: 16,
  minHeight: 520,
  minWidth: 0,
} as const;

const mobileSidebar = {
  padding: 14,
  minHeight: 0,
} as const;

const chatPanel = {
  padding: 16,
  minHeight: 520,
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
} as const;

const mobileChatPanel = {
  padding: 14,
  minHeight: 520,
} as const;

const pageHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "center",
  flexWrap: "wrap",
} as const;

const mobilePageHeader = {
  alignItems: "stretch",
} as const;

const backLink = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  border: "1px solid #CBEAF7",
  borderRadius: 14,
  background: "#EAF7FD",
  color: "#2D2A3E",
  padding: "10px 14px",
  fontWeight: 800,
  fontSize: 13,
} as const;

const mobileBackLink = {
  width: "100%",
} as const;

const sectionTitle = {
  margin: "0 0 10px 0",
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 700 as const,
};

const groupTitle = {
  margin: "0 0 10px",
  color: "#2D2A3E",
  fontSize: 16,
  fontWeight: 800,
};

const smallText = {
  margin: "4px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
};

const groupBox = {
  border: "1px solid #F0E3D8",
  borderRadius: 14,
  padding: 12,
  background: "#FFFDFB",
  marginBottom: 12,
} as const;

const contactButton = {
  width: "100%",
  borderRadius: 14,
  padding: "12px",
  color: "#2D2A3E",
  cursor: "pointer",
  textAlign: "left",
  display: "grid",
  gap: 3,
  marginBottom: 8,
} as const;

const contactTitleRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
} as const;

const contactUnreadBadge = {
  minWidth: 22,
  height: 22,
  borderRadius: 999,
  background: "#E53935",
  color: "#FFFFFF",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 7px",
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1,
} as const;

const labelText = {
  display: "block",
  margin: "0 0 6px",
  color: "#6D6888",
  fontSize: 12,
  fontWeight: 800,
};

const selectStyle = {
  width: "100%",
  border: "1px solid #E3D9CD",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#fff",
  color: "#2D2A3E",
  fontWeight: 700,
};

const selectedInfoBox = {
  marginTop: 10,
  border: "1px solid #CBEAF7",
  borderRadius: 14,
  padding: 12,
  background: "#EAF7FD",
};

const chatHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
  borderBottom: "1px solid #E8DCD2",
  paddingBottom: 12,
  marginBottom: 12,
} as const;

const mobileChatHeader = {
  flexWrap: "wrap",
} as const;

const rolePill = {
  background: "#FFF8E8",
  border: "1px solid #FFE3A3",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "capitalize",
} as const;

const messageList = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  overflowY: "auto",
  padding: "8px 0",
} as const;

const mobileMessageList = {
  minHeight: 260,
  maxHeight: "60vh",
} as const;

const emptyConversation = {
  border: "1px solid #F0E3D8",
  borderRadius: 14,
  padding: 14,
  color: "#6D6888",
  background: "#FFFDFB",
} as const;

const messageBubble = {
  maxWidth: "78%",
  border: "1px solid #E8DCD2",
  borderRadius: 16,
  padding: "10px 12px",
  color: "#2D2A3E",
} as const;

const mobileMessageBubble = {
  maxWidth: "100%",
} as const;

const timeText = {
  display: "block",
  marginTop: 6,
  color: "#8A8499",
  fontSize: 11,
} as const;

const replyBox = {
  display: "flex",
  gap: 10,
  alignItems: "flex-end",
  borderTop: "1px solid #E8DCD2",
  paddingTop: 12,
  marginTop: 12,
} as const;

const mobileReplyBox = {
  flexDirection: "column",
  alignItems: "stretch",
} as const;

const sendButton = {
  minWidth: 120,
  height: 46,
} as const;

const mobileSendButton = {
  width: "100%",
} as const;
