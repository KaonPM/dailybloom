import assert from "node:assert/strict";
import test from "node:test";
import { chooseWorkbookLanguage, chooseWorkbookYear, normalizeSelectedPages, schoolWorkbookLanguageAvailability, selectedPagesLabel, uniqueWorkbookEditions, workbookPagesFromQuery, workbookYears, type WorkbookCatalogueItem } from "./grade-r-workbooks";

const resource = (id: number, year: number, language: string): WorkbookCatalogueItem => ({ id, title: `Book ${id}`, academic_year: year, term: 1, language });

test("latest available workbook year is selected unless Master configured another available year", () => {
  const resources = [resource(1, 2026, "English"), resource(2, 2027, "English")];
  assert.equal(chooseWorkbookYear(resources), 2027);
  assert.equal(chooseWorkbookYear(resources, 2026), 2026);
  assert.equal(chooseWorkbookYear(resources, 2025), 2027);
});

test("school language is preferred only when that edition exists", () => {
  const resources = [resource(1, 2026, "English"), resource(2, 2026, "Setswana")];
  assert.equal(chooseWorkbookLanguage(resources, 2026, "Setswana"), "Setswana");
  assert.equal(chooseWorkbookLanguage(resources, 2026, "setswana"), "Setswana");
  assert.equal(chooseWorkbookLanguage(resources, 2026, "IsiZulu"), "English");
});

test("the school sees its home and first additional language editions without substituting an unrelated language", () => {
  const resources = [resource(1, 2026, "English"), resource(2, 2026, "Setswana"), resource(3, 2026, "Afrikaans"), resource(4, 2027, "IsiZulu")];
  assert.deepEqual(schoolWorkbookLanguageAvailability(resources, 2026, "setswana", "IsiZulu"), {
    available: ["Setswana"], missing: ["IsiZulu"],
  });
  assert.deepEqual(schoolWorkbookLanguageAvailability(resources, 2026, "Setswana", "Afrikaans"), {
    available: ["Setswana", "Afrikaans"], missing: [],
  });
});

test("page selection is durable, sorted and supports separate pages", () => {
  assert.deepEqual(normalizeSelectedPages([36, 34, 35, 35, 0, 90], 64), [34, 35, 36]);
  assert.equal(selectedPagesLabel([34, 35, 36, 40]), "Pages 34–36, 40");
});

test("an integrated workbook edition is shown once instead of once per learning area", () => {
  const duplicate = { ...resource(1, 2026, "English"), learning_areas: ["Home Language", "Mathematics", "Life Skills"] };
  const newer = { ...duplicate, id: 2, title: "Verified integrated edition" };
  assert.deepEqual(uniqueWorkbookEditions([duplicate, newer]).map((item) => item.id), [2]);
});

test("adding a new year retains historical years", () => {
  assert.deepEqual(workbookYears([resource(1, 2026, "English"), resource(2, 2027, "English")]), [2027, 2026]);
});

test("invalid and out-of-range pages are not persisted", () => {
  assert.deepEqual(normalizeSelectedPages([-1, 0, 1, 2.5, 65, Number.NaN], 64), [1]);
  assert.equal(selectedPagesLabel([]), "No pages selected");
});

test("older contiguous page links remain usable", () => {
  assert.deepEqual(workbookPagesFromQuery(null, "34", "36"), [34, 35, 36]);
  assert.deepEqual(workbookPagesFromQuery("34,36", "1", "50"), [34, 36]);
  assert.deepEqual(workbookPagesFromQuery(null, "1", "5000"), []);
});
