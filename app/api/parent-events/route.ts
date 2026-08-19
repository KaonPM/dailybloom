import { NextResponse } from "next/server";
import { getCurrentParent } from "@/app/lib/getCurrentParent";
import { parentCanAccessLearnerAtSchool } from "@/app/lib/parent-authorization-policy";
import {
  getJohannesburgTomorrowDate,
  getParentEventDateRange,
  type ParentEventRange,
} from "@/app/lib/parent-event-dates";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 10;
const EVENT_RANGES: ParentEventRange[] = [
  "Today",
  "This Week",
  "This Month",
  "Upcoming",
];

export async function GET(request: Request) {
  try {
    const parent = await getCurrentParent();

    if (!parent) {
      return NextResponse.json(
        { error: "Parent session required." },
        { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const { searchParams } = new URL(request.url);
    const learnerId = String(searchParams.get("learner_id") || "");
    const schoolId = Number(searchParams.get("school_id"));
    const requestedRange = String(searchParams.get("range") || "Today");
    const range = EVENT_RANGES.includes(requestedRange as ParentEventRange)
      ? (requestedRange as ParentEventRange)
      : "Today";
    const requestedPage = Number(searchParams.get("page") || 0);
    const page = Number.isInteger(requestedPage) && requestedPage >= 0
      ? requestedPage
      : 0;

    if (!learnerId || !schoolId) {
      return NextResponse.json(
        { error: "Missing learner or school context." },
        { status: 400 }
      );
    }

    if (
      !parentCanAccessLearnerAtSchool(
        parent.children || [],
        schoolId,
        learnerId
      )
    ) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    const dateRange = getParentEventDateRange(range);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE;

    let eventQuery = supabaseAdmin
      .from("events")
      .select("id, school_id, title, event_date, description, created_at")
      .eq("school_id", schoolId)
      .gte("event_date", dateRange.from)
      .order("event_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (dateRange.to) {
      eventQuery = eventQuery.lte("event_date", dateRange.to);
    }

    eventQuery = eventQuery.range(from, to);

    const tomorrow = getJohannesburgTomorrowDate();
    const [eventsResult, tomorrowResult] = await Promise.all([
      eventQuery,
      supabaseAdmin
        .from("events")
        .select("id, school_id, title, event_date, description, created_at")
        .eq("school_id", schoolId)
        .eq("event_date", tomorrow)
        .order("created_at", { ascending: true }),
    ]);

    if (eventsResult.error) {
      throw eventsResult.error;
    }

    if (tomorrowResult.error) {
      throw tomorrowResult.error;
    }

    const eventRows = eventsResult.data || [];

    return NextResponse.json(
      {
        events: eventRows.slice(0, PAGE_SIZE),
        hasMoreEvents: eventRows.length > PAGE_SIZE,
        tomorrowEvents: tomorrowResult.data || [],
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    console.error("Parent event fetch failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load events.",
      },
      { status: 500 }
    );
  }
}
