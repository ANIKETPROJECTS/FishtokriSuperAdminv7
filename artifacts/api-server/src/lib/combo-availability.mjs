export function isComboManuallyActive(combo) {
  return typeof combo?.manualIsActive === "boolean"
    ? combo.manualIsActive
    : combo?.isActive !== false;
}

export function isComboEffectivelyActive(combo, stockAvailable) {
  return isComboManuallyActive(combo) && stockAvailable;
}
