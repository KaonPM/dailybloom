import { stakeholderPresets } from "./report-config";
import type { ReportRow, StakeholderPresetKey } from "./types";

type ExecutivePrintOptions = {
  rows: ReportRow[];
  preset: StakeholderPresetKey;
  periodLabel: string;
  lastRefreshed: string;
  unavailableIndicatorCount: number;
};

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function valueFor(rows: ReportRow[], detail: string) {
  return rows.find((row) => row.detail === detail)?.value || "Data unavailable";
}

function buildNarrative(rows: ReportRow[]) {
  return `This portfolio view covers ${valueFor(
    rows,
    "Schools in scope"
  )} schools and ${valueFor(
    rows,
    "Learners reached"
  )} learners. Learner attendance for the selected period is ${valueFor(
    rows,
    "Learner attendance rate"
  )}, and ${valueFor(
    rows,
    "Schools using DailyBloom"
  )} schools recorded operational activity. Current reach and period activity are shown separately to support responsible interpretation.`;
}

export function buildExecutivePrintHtml({
  rows,
  preset,
  periodLabel,
  lastRefreshed,
  unavailableIndicatorCount,
}: ExecutivePrintOptions) {
  const activePreset =
    stakeholderPresets.find((item) => item.key === preset) ||
    stakeholderPresets[0];

  const categorySections = activePreset.categories
    .map((category) => {
      const categoryRows = rows.filter((row) => row.type === category);
      if (categoryRows.length === 0) return "";

      const cards = categoryRows
        .map(
          (row) => `
            <article class="metric${
              row.value === "Data unavailable" ? " unavailable" : ""
            }">
              <span>${escapeHtml(row.detail)}</span>
              <strong>${escapeHtml(row.value)}</strong>
              <small>${escapeHtml(row.status)}</small>
            </article>
          `
        )
        .join("");

      return `
        <section>
          <h2>${escapeHtml(category)}</h2>
          <div class="metrics">${cards}</div>
        </section>
      `;
    })
    .join("");

  const dataQualityNotice =
    unavailableIndicatorCount > 0
      ? `<div class="notice"><strong>Data quality notice:</strong> ${unavailableIndicatorCount} indicator${
          unavailableIndicatorCount === 1 ? "" : "s"
        } could not be calculated and are shown as "Data unavailable" rather than zero.</div>`
      : "";

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>DailyBloom ${escapeHtml(activePreset.label)} report</title>
        <style>
          @page { size: A4; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #2D2A3E;
            font-family: Arial, sans-serif;
            font-size: 11px;
          }
          header {
            border-bottom: 4px solid #78C9ED;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }
          .brand {
            color: #6B45E7;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: .08em;
            text-transform: uppercase;
          }
          h1 { margin: 5px 0; font-size: 25px; }
          h2 {
            margin: 0 0 9px;
            font-size: 15px;
            color: #3A3454;
          }
          p { color: #625D79; line-height: 1.5; }
          .meta {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin: 14px 0;
          }
          .meta div, .notice {
            border-radius: 10px;
            padding: 10px;
            background: #F8F4FB;
          }
          .notice {
            margin: 12px 0 18px;
            background: #FFF8E5;
            border: 1px solid #F0CF7C;
            color: #6B5420;
          }
          section {
            break-inside: avoid;
            margin: 0 0 15px;
            border-top: 1px solid #E9DFF1;
            padding-top: 12px;
          }
          .metrics {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }
          .metric {
            min-height: 82px;
            border: 1px solid #E6DFE9;
            border-radius: 10px;
            padding: 10px;
            background: #FFFFFF;
          }
          .metric span, .metric small {
            display: block;
            color: #6D6888;
          }
          .metric strong {
            display: block;
            margin: 7px 0 5px;
            font-size: 19px;
          }
          .metric.unavailable strong { color: #A04459; font-size: 13px; }
          .definitions {
            margin-top: 18px;
            padding: 12px 14px;
            border-radius: 10px;
            background: #F4FAFD;
            line-height: 1.5;
          }
          footer {
            margin-top: 18px;
            border-top: 1px solid #E5DEE8;
            padding-top: 10px;
            color: #7A748E;
            font-size: 9px;
          }
          @media print {
            .metric { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <header>
          <div class="brand">DailyBloom Master Reporting</div>
          <h1>${escapeHtml(activePreset.label)}</h1>
          <p>${escapeHtml(activePreset.description)}</p>
        </header>

        <div class="meta">
          <div><strong>Reporting period</strong><br />${escapeHtml(
            periodLabel
          )}</div>
          <div><strong>Last refreshed</strong><br />${escapeHtml(
            lastRefreshed
          )}</div>
          <div><strong>Portfolio scope</strong><br />${escapeHtml(
            valueFor(rows, "Schools in scope")
          )} schools</div>
        </div>

        <p>${escapeHtml(buildNarrative(rows))}</p>
        ${dataQualityNotice}
        ${categorySections}

        <div class="definitions">
          <strong>Interpretation</strong><br />
          Current indicators reflect records available when the report was refreshed.
          Period indicators include activity dated inside the selected reporting period.
          Expected monthly subscription revenue is a projection based on active or trial
          package prices and is not cash received. Percentages show their numerator and
          denominator where relevant.
        </div>

        <footer>
          Generated by DailyBloom. This report should be interpreted together with its
          reporting period, scope and data-quality notice.
        </footer>

        <script>
          window.onload = function () { window.print(); };
        </script>
      </body>
    </html>
  `;
}
