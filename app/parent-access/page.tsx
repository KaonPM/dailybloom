"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { resolveSchoolContext } from "../lib/school-context";
import {
  PARENTS_PER_PAGE,
  ParentAccessList,
  type LinkedLearner,
  type ParentGroup,
} from "./components/ParentAccessList";
import { ParentPortalPhoneDialog } from "./components/ParentPortalPhoneDialog";

type InviteResult = { sent?: boolean };
type PhoneEditor = LinkedLearner & { phone: string };

export default function ParentAccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [groups, setGroups] = useState<ParentGroup[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [parentPage, setParentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [phoneEditor, setPhoneEditor] = useState<PhoneEditor | null>(null);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [updatingPhone, setUpdatingPhone] = useState(false);

  const loadGroups = useCallback(async (id: number) => {
    setLoading(true);
    const response = await authenticatedFetch(
      `/api/parent-access/manage?school_id=${id}`
    );
    const result = await response.json();
    if (!response.ok) {
      alert(result.error || "Could not load Parent Portal access.");
      setLoading(false);
      return;
    }

    const nextGroups = (result.groups || []) as ParentGroup[];
    setGroups(nextGroups);
    setParentPage((current) =>
      Math.min(
        current,
        Math.max(1, Math.ceil(nextGroups.length / PARENTS_PER_PAGE))
      )
    );
    setSelected((current) =>
      current.filter((phone) =>
        nextGroups.some((group) => group.phone === phone)
      )
    );
    setLoading(false);
  }, []);

  const initialise = useCallback(async () => {
    const context = await resolveSchoolContext(searchParams.get("school"));
    if (!context.schoolId) {
      router.push(context.shouldReturnToMaster ? "/master" : "/dashboard");
      return;
    }
    setSchoolId(context.schoolId);
    await loadGroups(context.schoolId);
  }, [loadGroups, router, searchParams]);

  useEffect(() => {
    void initialise();
  }, [initialise]);

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (query.length < 3) return groups;

    return groups.filter((group) =>
      [group.parent_name, ...group.learners.map((learner) => learner.name)].some(
        (name) => name.toLocaleLowerCase().includes(query)
      )
    );
  }, [groups, searchQuery]);

  function updateSearchQuery(value: string) {
    setSearchQuery(value);
    setParentPage(1);
  }

  function toggle(phone: string) {
    setSelected((current) =>
      current.includes(phone)
        ? current.filter((item) => item !== phone)
        : [...current, phone]
    );
  }

  function toggleVisible(phones: string[], allSelected: boolean) {
    setSelected((current) =>
      allSelected
        ? current.filter((phone) => !phones.includes(phone))
        : [...new Set([...current, ...phones])]
    );
  }

  async function sendInvites() {
    if (!schoolId || !selected.length) return;
    setSending(true);
    const response = await authenticatedFetch("/api/parent-access/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school_id: schoolId, phones: selected }),
    });
    const result = await response.json();
    if (!response.ok) {
      alert(result.error || "Invitations could not be sent.");
    } else {
      const failed = ((result.results || []) as InviteResult[]).filter(
        (item) => !item.sent
      ).length;
      alert(
        failed
          ? `Invitations processed, but ${failed} SMS message(s) failed. Check the status below.`
          : "Parent Portal invitations sent successfully."
      );
      setSelected([]);
      await loadGroups(schoolId);
    }
    setSending(false);
  }

  function openPhoneEditor(learner: LinkedLearner, phone: string) {
    setPhoneEditor({ ...learner, phone });
    setPhoneDraft(phone);
  }

  function closePhoneEditor() {
    setPhoneEditor(null);
    setPhoneDraft("");
  }

  async function updateParentPortalPhone() {
    if (!schoolId || !phoneEditor) return;
    const confirmed = window.confirm(
      `Update the Parent Portal number for ${phoneEditor.name}? The previous number will lose access to this learner and existing sessions will be signed out.`
    );
    if (!confirmed) return;

    setUpdatingPhone(true);
    try {
      const response = await authenticatedFetch(
        "/api/learners/parent-portal-phone",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            school_id: schoolId,
            learner_id: phoneEditor.id,
            phone: phoneDraft,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.error || "Could not update the Parent Portal number."
        );
      }
      closePhoneEditor();
      alert(result.message);
      await loadGroups(schoolId);
    } catch (error: unknown) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not update the Parent Portal number."
      );
    } finally {
      setUpdatingPhone(false);
    }
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="db-parent-access-heading">
          <div>
            <h1 className="db-page-title">Parent Portal Access</h1>
            <p className="db-page-subtitle">
              Invite existing parents securely by SMS. One phone number
              receives one account for all linked learners.
            </p>
          </div>
          <div className="db-parent-access-actions">
            <Link
              className="db-main-pill db-main-pill-yellow"
              href={`/children${schoolId ? `?school=${schoolId}` : ""}`}
            >
              Back to Learners
            </Link>
            <Link
              className="db-main-pill db-main-pill-pink"
              href={`/dashboard${schoolId ? `?school=${schoolId}` : ""}`}
            >
              Dashboard
            </Link>
            <button
              className="db-button-primary"
              type="button"
              onClick={sendInvites}
              disabled={!selected.length || sending}
            >
              {sending
                ? "Sending..."
                : `Send ${selected.length || ""} Invitation${
                    selected.length === 1 ? "" : "s"
                  }`}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading parent access...</p>
      ) : (
        <ParentAccessList
          groups={filteredGroups}
          selected={selected}
          page={parentPage}
          searchQuery={searchQuery}
          onSearchChange={updateSearchQuery}
          onPageChange={setParentPage}
          onToggle={toggle}
          onToggleVisible={toggleVisible}
          onEditPhone={openPhoneEditor}
        />
      )}

      <ParentPortalPhoneDialog
        learner={phoneEditor}
        phone={phoneDraft}
        saving={updatingPhone}
        onPhoneChange={setPhoneDraft}
        onConfirm={updateParentPortalPhone}
        onClose={closePhoneEditor}
      />
    </div>
  );
}
