export type WorkbookCatalogueItem = {
  id: number;
  title: string;
  academic_year: number | null;
  term: number | null;
  book_number?: string | null;
  language: string | null;
  learning_areas?: string[] | null;
  page_count?: number | null;
  source_name?: string | null;
  catalogue_status?: string | null;
};

export function workbookYears(resources: WorkbookCatalogueItem[]) {
  return [...new Set(resources.map((resource) => resource.academic_year).filter((year): year is number => Number.isInteger(year)))].sort((a, b) => b - a);
}

export function uniqueWorkbookEditions<T extends WorkbookCatalogueItem>(resources: T[]): T[] {
  const editions = new Map<string, T>();
  for (const resource of resources) {
    const key = [resource.academic_year, resource.term, resource.book_number || resource.term, resource.language?.toLowerCase()].join("|");
    const existing = editions.get(key);
    if (!existing || resource.id > existing.id) editions.set(key, resource);
  }
  return [...editions.values()];
}

export function chooseWorkbookYear(resources: WorkbookCatalogueItem[], configuredDefault?: number | null) {
  const years = workbookYears(resources);
  return configuredDefault && years.includes(configuredDefault) ? configuredDefault : years[0] || new Date().getFullYear();
}

export function chooseWorkbookLanguage(resources: WorkbookCatalogueItem[], year: number, preferred?: string | null) {
  const languages = [...new Set(resources.filter((resource) => resource.academic_year === year).map((resource) => resource.language).filter((language): language is string => Boolean(language)))].sort();
  const preferredEdition = preferred ? languages.find((language) => language.localeCompare(preferred, undefined, { sensitivity: "accent" }) === 0) : null;
  const englishEdition = languages.find((language) => language.toLowerCase() === "english");
  return preferredEdition || englishEdition || languages[0] || "English";
}

export function normalizeSelectedPages(values: Iterable<number>, pageCount?: number | null) {
  return [...new Set([...values].filter((page) => Number.isInteger(page) && page > 0 && (!pageCount || page <= pageCount)))].sort((a, b) => a - b);
}

export function workbookPagesFromQuery(selected: string | null, from: string | null, to: string | null) {
  if (selected) return normalizeSelectedPages(selected.split(",").map(Number));
  const first = Number(from);
  const last = Number(to || from);
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last - first > 1999) return [];
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

export function selectedPagesLabel(pages: number[]) {
  const sorted = normalizeSelectedPages(pages);
  if (!sorted.length) return "No pages selected";
  const ranges: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (const page of sorted.slice(1)) {
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    ranges.push(start === previous ? String(start) : `${start}–${previous}`);
    start = previous = page;
  }
  ranges.push(start === previous ? String(start) : `${start}–${previous}`);
  return `Pages ${ranges.join(", ")}`;
}
