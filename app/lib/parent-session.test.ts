import assert from "node:assert/strict";
import test from "node:test";

process.env.PARENT_SESSION_SECRET = "test-only-parent-session-secret";

test("pending parent PIN challenges are signed and expire independently of the phone cookie", async () => {
  const {
    createPendingParentChallenge,
    verifyPendingParentChallenge,
  } = await import("./parent-challenge");
  const challenge = createPendingParentChallenge("0712345678");

  assert.equal(verifyPendingParentChallenge(challenge), "0712345678");
  assert.equal(
    verifyPendingParentChallenge(`${challenge.slice(0, -1)}x`),
    null
  );
  assert.equal(verifyPendingParentChallenge("0712345678"), null);
});
