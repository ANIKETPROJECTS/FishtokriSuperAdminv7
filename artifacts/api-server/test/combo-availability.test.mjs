import assert from "node:assert/strict";
import test from "node:test";
import {
  isComboEffectivelyActive,
  isComboManuallyActive,
} from "../src/lib/combo-availability.mjs";

test("manual disable stays disabled even when product stock is available", () => {
  const combo = { isActive: false, manualIsActive: false };
  assert.equal(isComboManuallyActive(combo), false);
  assert.equal(isComboEffectivelyActive(combo, true), false);
});

test("a manually enabled combo becomes active when stock is available", () => {
  const combo = { isActive: false, manualIsActive: true };
  assert.equal(isComboEffectivelyActive(combo, true), true);
  assert.equal(isComboEffectivelyActive(combo, false), false);
});

test("legacy combos use their existing isActive value as the manual setting", () => {
  assert.equal(isComboManuallyActive({ isActive: false }), false);
  assert.equal(isComboEffectivelyActive({ isActive: true }, true), true);
});
