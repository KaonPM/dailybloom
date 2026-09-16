import assert from "node:assert/strict";
import test from "node:test";
import { learnerDocumentStoragePath } from "./learner-document-storage";

const origin = "https://example.supabase.co";
test("resolves both current uploads and legacy public URLs", () => {
  assert.equal(learnerDocumentStoragePath({ file_path: "12/learner/document.pdf" }, origin, 12), "12/learner/document.pdf");
  assert.equal(learnerDocumentStoragePath({ file_url: `${origin}/storage/v1/object/public/learner-documents/12/learner/Contract%202026.pdf` }, origin, 12), "12/learner/Contract 2026.pdf");
  assert.equal(learnerDocumentStoragePath({}, origin, 12), null);
});
test("refuses foreign projects, buckets, schools and traversal paths", () => {
  for (const file_url of [
    "https://other.supabase.co/storage/v1/object/public/learner-documents/12/a.pdf",
    `${origin}/storage/v1/object/public/other-bucket/12/a.pdf`,
    `${origin}/storage/v1/object/public/learner-documents/15/a.pdf`,
  ]) assert.throws(() => learnerDocumentStoragePath({ file_url }, origin, 12));
  assert.throws(() => learnerDocumentStoragePath({ file_path: "12/../15/a.pdf" }, origin, 12));
});
