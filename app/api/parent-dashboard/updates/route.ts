import { NextResponse } from "next/server";
import { getCurrentParent } from "@/app/lib/getCurrentParent";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 5;
const TIMEZONE_OFFSET_HOURS = 2;
type ParentContext = NonNullable<Awaited<ReturnType<typeof getCurrentParent>>>;
type ParentChild = ParentContext["children"][number];

function toDateOnly(date: Date) {
  return date.toISOString().split("T")[0];
}

function getSouthAfricaToday() {
  const now = new Date();
  now.setUTCHours(now.getUTCHours() + TIMEZONE_OFFSET_HOURS);
  return toDateOnly(now);
}

function getUtcIsoForSouthAfricaDate(dateOnly: string, endOfDay = false) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const utcHour = endOfDay ? 21 : -TIMEZONE_OFFSET_HOURS;
  const utcMinute = endOfDay ? 59 : 0;
  const utcSecond = endOfDay ? 59 : 0;
  const utcMillisecond = endOfDay ? 999 : 0;

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      utcHour,
      utcMinute,
      utcSecond,
      utcMillisecond
    )
  ).toISOString();
}

function getDateRange(range: string) {
  const today = getSouthAfricaToday();
  const now = new Date(`${today}T00:00:00.000Z`);

  if (range === "Today") {
    return {
      from: getUtcIsoForSouthAfricaDate(today),
      to: getUtcIsoForSouthAfricaDate(today, true),
    };
  }

  if (range === "Week") {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 7);
    return {
      from: getUtcIsoForSouthAfricaDate(toDateOnly(start)),
      to: null,
    };
  }

  if (range === "Month") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return {
      from: getUtcIsoForSouthAfricaDate(toDateOnly(start)),
      to: null,
    };
  }

  return {
    from: null,
    to: null,
  };
}

function parentHasLearner(parent: ParentContext, learnerId: string) {
  return (parent?.children || []).some(
    (child: ParentChild) => String(child.id) === String(learnerId)
  );
}

function parentHasSchool(parent: ParentContext, schoolId: number) {
  return (parent?.children || []).some((child: ParentChild) => {
    const school = Array.isArray(child.schools) ? child.schools[0] : child.schools;
    return Number(child.school_id || school?.id) === schoolId;
  });
}

export async function GET(request: Request) {
  try {
    const parent = await getCurrentParent();

    if (!parent) {
      return NextResponse.json(
        { error: "Parent session required." },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const learnerId = String(searchParams.get("learner_id") || "");
    const schoolId = Number(searchParams.get("school_id"));
    const summaryRange = String(searchParams.get("summary_range") || "Today");
    const broadcastRange = String(searchParams.get("broadcast_range") || "Today");
    const summaryPage = Number(searchParams.get("summary_page") || 0);
    const broadcastPage = Number(searchParams.get("broadcast_page") || 0);

    if (!learnerId || !schoolId) {
      return NextResponse.json(
        { error: "Missing learner or school context." },
        { status: 400 }
      );
    }

    if (!parentHasLearner(parent, learnerId) || !parentHasSchool(parent, schoolId)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    const summaryFrom = summaryPage * PAGE_SIZE;
    const summaryTo = summaryFrom + PAGE_SIZE;
    const broadcastFrom = broadcastPage * PAGE_SIZE;
    const broadcastTo = broadcastFrom + PAGE_SIZE;

    const summaryDates = getDateRange(summaryRange);
    const broadcastDates = getDateRange(broadcastRange);

    let summaryQuery = supabaseAdmin
      .from("summaries")
      .select(
        `
          id,
          learner_id,
          learner_name,
          mood,
          meals,
          rest,
          health_safety,
          today_highlight,
          teacher_notes,
          created_at
        `
      )
      .eq("learner_id", learnerId)
      .eq("status", "sent")
      .order("created_at", { ascending: false });

    if (summaryDates.from) {
      summaryQuery = summaryQuery.gte("created_at", summaryDates.from);
    }

    if (summaryDates.to) {
      summaryQuery = summaryQuery.lte("created_at", summaryDates.to);
    }

    summaryQuery =
      summaryRange === "Today"
        ? summaryQuery.limit(1)
        : summaryQuery.range(summaryFrom, summaryTo);

    let broadcastQuery = supabaseAdmin
      .from("broadcasts")
      .select(
        `
          id,
          school_id,
          title,
          message,
          audience,
          recipient_count,
          created_at
        `
      )
      .eq("school_id", schoolId)
      .eq("status", "sent")
      .order("created_at", { ascending: false });

    if (broadcastDates.from) {
      broadcastQuery = broadcastQuery.gte("created_at", broadcastDates.from);
    }

    if (broadcastDates.to) {
      broadcastQuery = broadcastQuery.lte("created_at", broadcastDates.to);
    }

    broadcastQuery = broadcastQuery.range(broadcastFrom, broadcastTo);

    const [summaryResult, broadcastResult] = await Promise.all([
      summaryQuery,
      broadcastQuery,
    ]);

    if (summaryResult.error) {
      throw summaryResult.error;
    }

    if (broadcastResult.error) {
      throw broadcastResult.error;
    }

    return NextResponse.json(
      {
        summaries: summaryResult.data || [],
        broadcasts: broadcastResult.data || [],
        hasMoreSummaries:
          summaryRange !== "Today" && (summaryResult.data || []).length > PAGE_SIZE,
        hasMoreBroadcasts: (broadcastResult.data || []).length > PAGE_SIZE,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: unknown) {
    console.error("Parent dashboard updates failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load parent dashboard updates." },
      { status: 500 }
    );
  }
}
