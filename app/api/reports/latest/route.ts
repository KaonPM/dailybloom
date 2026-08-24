import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

type ReportRow = {
  date: string;
  learner: string;
  classroom: string;
  type: string;
  detail: string;
  extra: string;
};

type LearnerLookup = Record<string, { name: string; classroom: string }>;

function dateOnly(value: unknown) {
  return String(value || "").split("T")[0];
}

function money(value: unknown) {
  return `R${Number(value || 0).toFixed(2)}`;
}

async function getLearnerLookup(schoolId: number) {
  const { data, error } = await supabaseAdmin
    .from("learners")
    .select("id, name, class")
    .eq("school_id", schoolId);
  if (error) throw error;

  return Object.fromEntries(
    (data || []).map((learner) => [
      String(learner.id),
      {
        name: String(learner.name || "Unnamed learner"),
        classroom: String(learner.class || "Unassigned"),
      },
    ])
  ) as LearnerLookup;
}

function learnerDetails(learners: LearnerLookup, learnerId: unknown) {
  return learners[String(learnerId)] || {
    name: "Learner not available",
    classroom: "Unassigned",
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = Number(url.searchParams.get("school_id"));
  const workflow = String(url.searchParams.get("workflow") || "");
  const from = String(url.searchParams.get("from") || "");
  const to = String(url.searchParams.get("to") || "");

  if (!schoolId || !workflow || !from || !to) {
    return NextResponse.json({ error: "School, report type and date range are required." }, { status: 400 });
  }

  const authorization = await requireStaffPermission(request, PERMISSIONS.REPORTS_VIEW, schoolId);
  if (!authorization.ok) return authorization.response;

  try {
    const learners = await getLearnerLookup(schoolId);
    let rows: ReportRow[] = [];

    if (workflow === "communications") {
      const { data, error } = await supabaseAdmin
        .from("communications")
        .select("sent_date, created_at, learner_name, communication_type, status, message")
        .eq("school_id", schoolId)
        .gte("sent_date", from)
        .lte("sent_date", to)
        .order("sent_date", { ascending: false });
      if (error) throw error;
      rows = (data || []).map((item) => ({
        date: dateOnly(item.sent_date || item.created_at),
        learner: String(item.learner_name || "School audience"),
        classroom: "Parent communication",
        type: String(item.communication_type || "Communication"),
        detail: String(item.status || "Recorded"),
        extra: String(item.message || ""),
      }));
    }

    if (workflow === "homework") {
      const { data, error } = await supabaseAdmin
        .from("homework_assignments")
        .select("activity_date, due_date, instruction_note, classroom_id, homework_library(title, file_name), classrooms(name)")
        .eq("school_id", schoolId)
        .gte("activity_date", from)
        .lte("activity_date", to)
        .order("activity_date", { ascending: false });
      if (error) throw error;
      rows = (data || []).map((item) => {
        const library = Array.isArray(item.homework_library) ? item.homework_library[0] : item.homework_library;
        const classroom = Array.isArray(item.classrooms) ? item.classrooms[0] : item.classrooms;
        return {
          date: dateOnly(item.activity_date),
          learner: "Class homework",
          classroom: String(classroom?.name || `Classroom ${item.classroom_id}`),
          type: "Homework",
          detail: String(library?.title || "Instructions only"),
          extra: `Due: ${dateOnly(item.due_date) || "Not set"}${item.instruction_note ? ` | ${item.instruction_note}` : ""}${library?.file_name ? ` | File: ${library.file_name}` : ""}`,
        };
      });
    }

    if (workflow === "learner_support") {
      const [{ data: outcomes, error: outcomesError }, { data: updates, error: updatesError }] = await Promise.all([
        supabaseAdmin
          .from("learner_activity_outcomes")
          .select("learner_id, developmental_area, activity_name, activity_date, observation, support_status, created_at")
          .eq("school_id", schoolId)
          .eq("outcome_status", "needs_support")
          .gte("activity_date", from)
          .lte("activity_date", to)
          .order("activity_date", { ascending: false }),
        supabaseAdmin
          .from("learner_support_updates")
          .select("learner_id, support_status, support_identified, intervention, progress_note, parent_summary, next_review_date, recorded_by_name, recorded_at, learner_activity_outcomes(developmental_area, activity_name)")
          .eq("school_id", schoolId)
          .gte("recorded_at", `${from}T00:00:00`)
          .lte("recorded_at", `${to}T23:59:59`)
          .order("recorded_at", { ascending: false }),
      ]);
      if (outcomesError || updatesError) throw outcomesError || updatesError;

      const initialCases = (outcomes || []).map((item) => {
        const learner = learnerDetails(learners, item.learner_id);
        return {
          date: dateOnly(item.activity_date || item.created_at),
          learner: learner.name,
          classroom: learner.classroom,
          type: "Learner Support",
          detail: `${item.developmental_area || "Support area"} | Initial support case | ${item.support_status || "new"}`,
          extra: [item.activity_name ? `Activity: ${item.activity_name}` : "", item.observation ? `Observation: ${item.observation}` : ""].filter(Boolean).join(" | "),
        };
      });
      const followUps = (updates || []).map((item) => {
        const learner = learnerDetails(learners, item.learner_id);
        const outcome = Array.isArray(item.learner_activity_outcomes) ? item.learner_activity_outcomes[0] : item.learner_activity_outcomes;
        return {
          date: dateOnly(item.recorded_at),
          learner: learner.name,
          classroom: learner.classroom,
          type: "Learner Support",
          detail: `${outcome?.developmental_area || "Support area"} | ${item.support_status || "new"}`,
          extra: [item.support_identified ? `Support identified: ${item.support_identified}` : "", item.intervention, item.progress_note, item.parent_summary, item.next_review_date ? `Next review: ${item.next_review_date}` : "", item.recorded_by_name ? `Recorded by: ${item.recorded_by_name}` : ""].filter(Boolean).join(" | "),
        };
      });
      rows = [...initialCases, ...followUps].sort((a, b) => b.date.localeCompare(a.date));
    }

    if (workflow === "achievement_awards") {
      const { data, error } = await supabaseAdmin
        .from("achievement_awards")
        .select("learner_id, award_name, award_category, award_reason, workflow_status, teacher_name, issued_at, created_at")
        .eq("school_id", schoolId)
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      rows = (data || []).map((item) => {
        const learner = learnerDetails(learners, item.learner_id);
        return {
          date: dateOnly(item.issued_at || item.created_at),
          learner: learner.name,
          classroom: learner.classroom,
          type: "Achievement Award",
          detail: `${item.award_name || "Award"} | ${item.workflow_status || "nominated"}`,
          extra: [item.award_category, item.award_reason, item.teacher_name ? `Practitioner: ${item.teacher_name}` : ""].filter(Boolean).join(" | "),
        };
      });
    }

    if (workflow === "learner_requirements") {
      const [{ data: items, error: itemError }, { data: documents, error: documentError }] = await Promise.all([
        supabaseAdmin.from("learner_stationery_checklist").select("learner_id, item_name, received, quantity_received, quantity_required, updated_at, created_at").eq("school_id", schoolId),
        supabaseAdmin.from("learner_documents").select("learner_id, document_type, file_name, uploaded_at").eq("school_id", schoolId),
      ]);
      if (itemError || documentError) throw itemError || documentError;
      const itemRows = (items || []).filter((item) => {
        const date = dateOnly(item.updated_at || item.created_at);
        return date >= from && date <= to;
      }).map((item) => {
        const learner = learnerDetails(learners, item.learner_id);
        return {
          date: dateOnly(item.updated_at || item.created_at),
          learner: learner.name,
          classroom: learner.classroom,
          type: "Requirement Item",
          detail: String(item.item_name || "Requirement"),
          extra: `${item.quantity_received || 0}/${item.quantity_required || 0} received${item.received ? " | Complete" : " | Outstanding"}`,
        };
      });
      const documentRows = (documents || []).filter((item) => {
        const date = dateOnly(item.uploaded_at);
        return date >= from && date <= to;
      }).map((item) => {
        const learner = learnerDetails(learners, item.learner_id);
        return {
          date: dateOnly(item.uploaded_at),
          learner: learner.name,
          classroom: learner.classroom,
          type: "Learner Document",
          detail: String(item.document_type || "Document"),
          extra: String(item.file_name || "Uploaded"),
        };
      });
      rows = [...itemRows, ...documentRows].sort((a, b) => b.date.localeCompare(a.date));
    }

    if (workflow === "parent_permissions") {
      const { data: requests, error } = await supabaseAdmin
        .from("parent_permission_requests")
        .select("id, title, permission_type, status, event_date, response_deadline, created_at")
        .eq("school_id", schoolId)
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (requests || []).map((item) => item.id);
      const [{ data: allocations }, { data: responses }] = ids.length
        ? await Promise.all([
            supabaseAdmin.from("parent_permission_request_learners").select("request_id").in("request_id", ids),
            supabaseAdmin.from("parent_permission_responses").select("request_id, response").in("request_id", ids),
          ])
        : [{ data: [] }, { data: [] }];
      rows = (requests || []).map((item) => {
        const assigned = (allocations || []).filter((row) => row.request_id === item.id).length;
        const granted = (responses || []).filter((row) => row.request_id === item.id && row.response === "granted").length;
        const declined = (responses || []).filter((row) => row.request_id === item.id && row.response === "declined").length;
        return {
          date: dateOnly(item.created_at),
          learner: "Parent group",
          classroom: "Entire School",
          type: "Parent Permission",
          detail: `${item.title} | ${item.status}`,
          extra: `Assigned: ${assigned} | Granted: ${granted} | Declined: ${declined} | Awaiting: ${Math.max(0, assigned - granted - declined)}${item.event_date ? ` | Event: ${item.event_date}` : ""}`,
        };
      });
    }

    if (workflow === "learner_fees") {
      const [{ data: charges, error: chargeError }, { data: payments, error: paymentError }] = await Promise.all([
        supabaseAdmin.from("learner_fee_charges").select("learner_id, description, charge_type, billing_period, due_date, amount").eq("school_id", schoolId).gte("billing_period", from).lte("billing_period", to),
        supabaseAdmin.from("learner_fee_payments").select("learner_id, amount, payment_date, payment_method, reference_number, receipt_number").eq("school_id", schoolId).gte("payment_date", from).lte("payment_date", to),
      ]);
      if (chargeError || paymentError) throw chargeError || paymentError;
      const chargeRows = (charges || []).map((item) => {
        const learner = learnerDetails(learners, item.learner_id);
        return {
          date: dateOnly(item.billing_period),
          learner: learner.name,
          classroom: learner.classroom,
          type: "Fee Charge",
          detail: String(item.description || item.charge_type || "School fee"),
          extra: `${money(item.amount)} | Due: ${dateOnly(item.due_date)}`,
        };
      });
      const paymentRows = (payments || []).map((item) => {
        const learner = learnerDetails(learners, item.learner_id);
        return {
          date: dateOnly(item.payment_date),
          learner: learner.name,
          classroom: learner.classroom,
          type: "Fee Payment",
          detail: `${money(item.amount)} | ${item.payment_method}`,
          extra: `Receipt: ${item.receipt_number}${item.reference_number ? ` | Reference: ${item.reference_number}` : ""}`,
        };
      });
      rows = [...chargeRows, ...paymentRows].sort((a, b) => b.date.localeCompare(a.date));
    }

    if (authorization.staff.role === "teacher") {
      const assignedClassroom = String(
        authorization.staff.profile.classroom_name || ""
      )
        .trim()
        .toLowerCase();
      rows = assignedClassroom
        ? rows.filter(
            (row) => row.classroom.trim().toLowerCase() === assignedClassroom
          )
        : [];
    }

    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The report could not be generated." },
      { status: 400 }
    );
  }
}
