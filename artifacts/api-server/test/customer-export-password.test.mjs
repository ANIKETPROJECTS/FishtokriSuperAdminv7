import assert from "node:assert/strict";
import test from "node:test";
import { customerExportPasswordMatches } from "../src/lib/customer-export-password.mjs";

test("accepts an exact configured export password", () => {
  assert.equal(customerExportPasswordMatches("local-test-passphrase", "local-test-passphrase"), true);
});

test("rejects wrong, empty, and non-string export passwords", () => {
  assert.equal(customerExportPasswordMatches("wrong-passphrase", "local-test-passphrase"), false);
  assert.equal(customerExportPasswordMatches("", "local-test-passphrase"), false);
  assert.equal(customerExportPasswordMatches("local-test-passphrase", ""), false);
  assert.equal(customerExportPasswordMatches(undefined, "local-test-passphrase"), false);
});
