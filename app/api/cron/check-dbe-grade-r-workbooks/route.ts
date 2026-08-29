import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";

type OfficialWorkbook = {
  title: string;
  language: string;
  term: number;
  sourceUrl: string;
  learningArea: string;
};

function decodeHtml(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("%3d", "%3D");
}

function learningAreaFor(language: string) {
  if (language === "English") return "English Home Language";
  if (language === "Afrikaans") return "Afrikaans First Additional Language";
  return "Other Home Languages";
}

function extractWorkbooks(html: string): OfficialWorkbook[] {
  const results: OfficialWorkbook[] = [];
  const books = html.matchAll(/Grade R:\s*Book\s*([1-4])[\s\S]*?(?=<h2|$)/gi);
  for (const bookMatch of books) {
    const term = Number(bookMatch[1]);
    for (const row of bookMatch[0].matchAll(/<td class="TitleCell"><a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi)) {
      const language = row[2].trim();
      if (!language) continue;
      results.push({
        title: `DBE Grade R Workbook Book ${term} — ${language}`,
        language,
        term,
        sourceUrl: `https://www.education.gov.za${decodeHtml(row[1])}`,
        learningArea: learningAreaFor(language),
      });
    }
  }
  return results;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const year = new Date().getUTCFullYear();
  const sourcePages = [
    `https://www.education.gov.za/Curriculum/LearningandTeachingSupportMaterials(LTSM)/${year}Workbooks1.aspx`,
    `https://www.education.gov.za/Curriculum/LearningandTeachingSupportMaterials(LTSM)/${year}WorkbooksTerm3and4.aspx`,
  ];

  try {
    const responses = await Promise.all(sourcePages.map((url) => fetch(url, { signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "DailyBloom-DBE-Resource-Review/1.0" } })));
    if (responses.some((response) => !response.ok)) throw new Error("The official DBE workbook pages could not be read.");
    const workbooks = (await Promise.all(responses.map((response) => response.text()))).flatMap(extractWorkbooks);
    if (!workbooks.length) throw new Error("No Grade R workbook editions were found on the official DBE pages.");

    const [{ data: published, error: publishedError }, { data: pending, error: pendingError }] = await Promise.all([
      supabaseAdmin.from("learning_resources").select("title, source_url").eq("grade", "Grade R").eq("academic_year", year).eq("status", "published").is("school_id", null),
      supabaseAdmin.from("learning_resource_update_reviews").select("title, academic_year").eq("academic_year", year).eq("status", "pending"),
    ]);
    if (publishedError || pendingError) throw publishedError || pendingError;
    const publishedByTitle = new Map((published || []).map((item) => [String(item.title), String(item.source_url || "")]));
    const pendingTitles = new Set((pending || []).map((item) => String(item.title)));
    const candidates = workbooks.filter((workbook) => {
      const existingUrl = publishedByTitle.get(workbook.title);
      if (!existingUrl) return !pendingTitles.has(workbook.title);
      // A current catalogue-page link is a valid reference and should not create
      // a noisy one-time batch merely because DBE also exposes direct links.
      return !existingUrl.includes(`${year}Workbooks`) && existingUrl !== workbook.sourceUrl && !pendingTitles.has(workbook.title);
    });

    if (candidates.length) {
      const { error } = await supabaseAdmin.from("learning_resource_update_reviews").insert(candidates.map((workbook) => ({
        title: workbook.title,
        grade: "Grade R",
        source_name: "Department of Basic Education",
        source_url: workbook.sourceUrl,
        academic_year: year,
        review_notes: "Detected by the scheduled official DBE Grade R workbook check. Verify the source before approval.",
        proposed_resource: {
          resource_type: "DBE Workbook",
          language: workbook.language,
          term: workbook.term,
          learning_area: workbook.learningArea,
          content_rights: "DBE State-Owned",
          is_downloadable: true,
          is_printable: true,
          is_parent_shareable: true,
        },
      })));
      if (error) throw error;
    }
    return NextResponse.json({ success: true, year, found: workbooks.length, queued: candidates.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The DBE workbook check failed." }, { status: 500 });
  }
}
