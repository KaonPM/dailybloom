import assert from "node:assert/strict";
import test from "node:test";
import { enrolmentWhatsAppBodyParameters } from "./whatsapp-template-parameters";

test("registration WhatsApp greets the parent before naming the school", () => {
  assert.deepEqual(
    enrolmentWhatsAppBodyParameters("registration", ["jugg", "Little Stars Pre School", "R 100,00", "LSPS-2026-0032", "Bank details"]),
    ["jugg", "Little Stars Pre School", "R 100,00", "LSPS-2026-0032", "Bank details"],
  );
});
