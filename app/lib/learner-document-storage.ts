export function learnerDocumentStoragePath(
  document: { file_path?: string | null; file_url?: string | null },
  supabaseUrl: string,
  schoolId: number
) {
  let path = document.file_path || "";
  if (!path && document.file_url) {
    const url = new URL(document.file_url);
    const prefix = "/storage/v1/object/public/learner-documents/";
    if (url.origin !== new URL(supabaseUrl).origin || !url.pathname.startsWith(prefix)) {
      throw new Error("The document's storage location could not be verified.");
    }
    path = decodeURIComponent(url.pathname.slice(prefix.length));
  }
  if (!path) return null;
  if (!path.startsWith(`${schoolId}/`) || path.split("/").some((part) => part === ".." || part === ".") || path.includes("\\")) {
    throw new Error("The document's storage location does not belong to this school.");
  }
  return path;
}
