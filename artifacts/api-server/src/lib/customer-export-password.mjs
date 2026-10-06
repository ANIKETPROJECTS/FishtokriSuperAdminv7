import crypto from "node:crypto";

export function customerExportPasswordMatches(submittedPassword, configuredPassword) {
  if (typeof submittedPassword !== "string" || typeof configuredPassword !== "string") return false;

  const submitted = Buffer.from(submittedPassword, "utf8");
  const configured = Buffer.from(configuredPassword, "utf8");
  return (
    submitted.length > 0 &&
    configured.length > 0 &&
    submitted.length === configured.length &&
    crypto.timingSafeEqual(submitted, configured)
  );
}
