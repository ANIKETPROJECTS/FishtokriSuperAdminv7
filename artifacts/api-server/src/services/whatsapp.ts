/**
 * WhatsApp notification service — Admark Verified WhatsApp API
 * Docs: https://verifiedwhatsapp.admarksolution.com
 *
 * Credentials are read from environment variables:
 *   WABA_API_KEY   — API key
 *   WABA_PHONE_ID  — WhatsApp Business phone number ID
 */

const WABA_API_BASE = "https://verifiedwhatsapp.admarksolution.com";
const SEND_TIMEOUT_MS = 15_000; // 15 s per attempt
const MAX_RETRIES = 2; // 1 initial + 1 retry

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise an Indian mobile number to the 91XXXXXXXXXX format the API
 * expects. Returns null for unrecognised formats (caller skips the send).
 * Handles:
 *   10 digits            → 91XXXXXXXXXX
 *   11 digits, leading 0 → 91XXXXXXXXXX  (e.g. 0XXXXXXXXXX)
 *   12 digits, starts 91 → unchanged
 */
function formatPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return null;
}

/**
 * Build the human-readable items block used inside the order-confirmed bill.
 * Items are joined with " | " (single line) so the value is safe for
 * WhatsApp template variables — multi-line newlines and bullet characters
 * cause some API implementations to reject the request.
 * Example: "Fish (500g) x2 - Rs.300 | Prawns x1 - Rs.450"
 */
export function buildItemsText(
  items: Array<{ name: string; quantity: number; price: number; unit?: string }>
): string {
  if (!Array.isArray(items) || items.length === 0) return "-";
  return items
    .map((it) => {
      const unit = it.unit ? ` (${it.unit})` : "";
      const lineTotal = (Number(it.price) || 0) * (Number(it.quantity) || 1);
      return `${it.name}${unit} x${it.quantity} - Rs.${lineTotal}`;
    })
    .join(" | ");
}

type Logger = {
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
  info: (obj: object, msg?: string) => void;
};

// ---------------------------------------------------------------------------
// Core send function — with timeout + retry
// ---------------------------------------------------------------------------

/**
 * Attempt a single HTTP call to the Admark API.
 * Throws on non-success so the caller can retry.
 */
async function attemptSend(
  templateName: string,
  formattedPhone: string,
  varsObj: Record<string, string>,
  apiKey: string,
  phoneId: string,
  attemptNum: number,
  log: Logger
): Promise<void> {
  const params = new URLSearchParams({
    "api-key": apiKey,
    templateName,
    phoneNumber: formattedPhone,
    phoneNumberId: phoneId,
    variables: JSON.stringify(varsObj),
  });

  const requestUrl = `${WABA_API_BASE}/api/send/bytemplate?${params.toString()}`;

  // Log full details (mask API key in the URL shown)
  const maskedUrl = requestUrl.replace(/(api-key=)[^&]+/, "$1***");
  console.log(
    `[WhatsApp][attempt ${attemptNum}] SEND → template=${templateName} phone=${formattedPhone}\n` +
    `  variables: ${JSON.stringify(varsObj)}\n` +
    `  url: ${maskedUrl}`
  );
  log.info(
    { templateName, phone: formattedPhone, variables: varsObj, attempt: attemptNum },
    `[WhatsApp] Sending template (attempt ${attemptNum})`
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  let httpStatus: number;
  let rawText: string;
  let data: any;
  try {
    const resp = await fetch(requestUrl, { signal: controller.signal });
    httpStatus = resp.status;
    rawText = await resp.text();
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { rawText };
    }
  } finally {
    clearTimeout(timer);
  }

  // Always log the full raw response so we can see exactly what Admark returns.
  console.log(
    `[WhatsApp][attempt ${attemptNum}] RESPONSE ← httpStatus=${httpStatus} body=${rawText}`
  );
  log.info(
    { templateName, phone: formattedPhone, httpStatus, response: data, attempt: attemptNum },
    "[WhatsApp] Admark raw response"
  );

  if (!data?.success) {
    const errMsg = `[WhatsApp] API returned failure: httpStatus=${httpStatus} body=${rawText}`;
    log.error({ templateName, phone: formattedPhone, httpStatus, response: data, attempt: attemptNum }, errMsg);
    console.error(errMsg);
    throw new Error(errMsg);
  }

  console.log(
    `[WhatsApp][attempt ${attemptNum}] SUCCESS → template=${templateName} phone=${formattedPhone} ` +
    `requestId=${data.requestId ?? "(none)"} msgId=${data.messageId ?? data.msg_id ?? "(none)"}`
  );
  log.info(
    { templateName, phone: formattedPhone, requestId: data.requestId, response: data, attempt: attemptNum },
    "[WhatsApp] Message accepted by Admark"
  );
}

/**
 * Core send function.
 * Variables are passed as a URL-encoded JSON object (body1, body2, …)
 * so commas and newlines inside variable values are safe.
 * Retries up to MAX_RETRIES times on timeout or network error.
 *
 * @param extraVars  Additional Admark variable keys to merge in, e.g. { url1: "https://..." }
 *                   for templates that have a dynamic CTA button URL.
 */
async function sendTemplate(
  templateName: string,
  phone: string,
  bodyVars: string[],
  log?: Logger,
  extraVars?: Record<string, string>
): Promise<void> {
  const logger: Logger = log ?? {
    warn: (o, m) => console.warn(m, o),
    error: (o, m) => console.error(m, o),
    info: (o, m) => console.log(m, o),
  };

  const apiKey = process.env.WABA_API_KEY;
  const phoneId = process.env.WABA_PHONE_ID;

  if (!apiKey || !phoneId) {
    logger.warn({ templateName }, "[WhatsApp] WABA_API_KEY or WABA_PHONE_ID not set — skipping");
    console.warn(`[WhatsApp] WABA_API_KEY or WABA_PHONE_ID not set — skipping template=${templateName}`);
    return;
  }

  const formattedPhone = formatPhone(phone);
  if (!formattedPhone) {
    logger.warn(
      { phone, templateName },
      "[WhatsApp] Unrecognised phone format — skipping"
    );
    console.warn(`[WhatsApp] Unrecognised phone format="${phone}" for template=${templateName} — skipping`);
    return;
  }

  // Build named variable object: { body1: "...", body2: "...", … }
  // Merge any extra vars (e.g. url1 for CTA button URLs) after the body vars.
  const varsObj: Record<string, string> = {};
  bodyVars.forEach((v, i) => {
    varsObj[`body${i + 1}`] = String(v ?? "").trim();
  });
  if (extraVars) {
    Object.assign(varsObj, extraVars);
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await attemptSend(templateName, formattedPhone, varsObj, apiKey, phoneId, attempt, logger);
      return; // success — stop
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        const delay = attempt * 2000; // 2 s, 4 s …
        console.warn(
          `[WhatsApp][attempt ${attempt}] FAILED for template=${templateName} phone=${formattedPhone} — retrying in ${delay}ms. Error: ${String(err)}`
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  // All attempts failed
  logger.error(
    { err: lastErr, templateName, phone: formattedPhone },
    `[WhatsApp] All ${MAX_RETRIES} attempts failed`
  );
  console.error(
    `[WhatsApp] ALL ${MAX_RETRIES} ATTEMPTS FAILED → template=${templateName} phone=${formattedPhone}. Last error: ${String(lastErr)}`
  );
}

// ---------------------------------------------------------------------------
// Public send functions — one per template
// ---------------------------------------------------------------------------

/**
 * Fires when an order is accepted (status → confirmed).
 * Template: fishtokri_order_confirmed
 * Variables: {{1}} name, {{2}} orderId, {{3}} items, {{4}} subtotal,
 *            {{5}} discount, {{6}} delivery, {{7}} total,
 *            {{8}} paymentMode, {{9}} address
 */
export async function sendOrderConfirmed(order: any, log?: Logger): Promise<void> {
  const phone = String(order.phone ?? "").trim();
  if (!phone) {
    (log ?? console).warn({ orderId: String(order._id) }, "[WhatsApp] Order has no phone — skipping order_confirmed");
    console.warn(`[WhatsApp] Order ${order._id} has no phone field — skipping order_confirmed`);
    return;
  }

  // Use the stored FTS order ID; fall back to short hex if missing.
  // Strip any leading '#' — the WhatsApp template text already has a '#' before {{2}},
  // so passing '#FTS...' would produce '##FTS...' in the delivered message.
  const orderId =
    (String(order.orderId ?? "").trim() ||
     `ORD-${String(order._id).slice(-6).toUpperCase()}`).replace(/^#+/, "");

  const itemsText = buildItemsText(order.items ?? []);
  const subtotal = String(order.subtotal ?? 0);
  const discount = String(order.discount ?? 0);
  const deliveryCharge = String(order.deliveryCharge ?? 0);
  const total = String(order.total ?? 0);
  const rawMode = String(order.paymentMode ?? "").trim().toLowerCase();
  const paymentMode =
    rawMode === "cod" ? "Cash on Delivery" :
    rawMode === "upi" ? "UPI" :
    rawMode === "online" ? "Online" :
    rawMode || "Cash on Delivery";
  const address =
    String(order.address ?? order.deliveryArea ?? "").trim() || "—";

  console.log(
    `[WhatsApp] sendOrderConfirmed → orderId=${orderId} customer=${order.customerName} phone=${phone}`
  );

  await sendTemplate(
    "fishtokri_order_confirmed",
    phone,
    [
      String(order.customerName ?? "Customer"),
      orderId,
      itemsText,
      subtotal,
      discount,
      deliveryCharge,
      total,
      paymentMode,
      address,
    ],
    log
  );
}

/**
 * Fires when an order goes out for delivery (status → out_for_delivery).
 *
 * Routing:
 *   UPI / wallet / UPI+wallet (or COD fully paid via wallet, dueAmount = 0)
 *     → fishtokri_out_for_delivery  (4 vars): name, orderId, dp_name, dp_phone
 *
 *   COD / COD+wallet with outstanding due amount (dueAmount > 0)
 *     → fishtokri_out_for_delivery_cod (5 vars): name, orderId, amount_due, dp_name, dp_phone
 *     Includes a Razorpay "Pay Now" button baked into the template.
 */
export async function sendOutForDelivery(
  order: any,
  deliveryPersonPhone: string,
  log?: Logger
): Promise<void> {
  const phone = String(order.phone ?? "").trim();
  if (!phone) {
    console.warn(`[WhatsApp] Order ${order._id} has no phone field — skipping out_for_delivery`);
    return;
  }

  const orderId =
    (String(order.orderId ?? "").trim() ||
     `ORD-${String(order._id).slice(-6).toUpperCase()}`).replace(/^#+/, "");

  const dpName =
    String(order.assignedDeliveryPersonName ?? "").trim() ||
    "Our delivery partner";
  const dpPhone = deliveryPersonPhone.trim() || "-";

  // COD detection:
  //   - paymentMode must be "cod", "cash", or empty (default cash order)
  //   - AND dueAmount must be > 0 (if fully paid via wallet the customer owes nothing at door)
  const rawMode = String(order.paymentMode ?? "").trim().toLowerCase();
  const isCashMode = rawMode === "cod" || rawMode === "cash" || rawMode === "";
  const dueAmount = Number(order.dueAmount ?? 0);
  const isCod = isCashMode && dueAmount > 0;

  const templateName = isCod
    ? "fishtokri_out_for_delivery_cod"
    : "fishtokri_out_for_delivery";

  console.log(
    `[WhatsApp] sendOutForDelivery → orderId=${orderId} customer=${order.customerName} ` +
    `phone=${phone} dp=${dpName} dpPhone=${dpPhone} ` +
    `paymentMode=${rawMode || "(empty)"} dueAmount=${dueAmount} template=${templateName}`
  );

  if (isCod) {
    // COD template: {{1}} name, {{2}} orderId, {{3}} amount_due, {{4}} dp_name, {{5}} dp_phone
    // The template also has a "Pay Now" CTA button with a dynamic URL (url1).
    // Until Razorpay is integrated we pass a placeholder — this is required by WhatsApp
    // to actually deliver the message; omitting url1 causes silent non-delivery.
    const paymentLink = String(order.razorpayPaymentLink ?? "").trim() || "https://fishtokri.com";
    await sendTemplate(
      templateName,
      phone,
      [
        String(order.customerName ?? "Customer"),
        orderId,
        String(dueAmount),
        dpName,
        dpPhone,
      ],
      log,
      { url1: paymentLink }
    );
  } else {
    // Non-COD template: {{1}} name, {{2}} orderId, {{3}} dp_name, {{4}} dp_phone
    await sendTemplate(
      templateName,
      phone,
      [
        String(order.customerName ?? "Customer"),
        orderId,
        dpName,
        dpPhone,
      ],
      log
    );
  }
}

/**
 * Fires when an order is cancelled from the backend (status → cancelled).
 * Template: fishtokri_order_cancelled
 * Variables: {{1}} name, {{2}} orderId, {{3}} reason
 */
export async function sendOrderCancelled(order: any, log?: Logger): Promise<void> {
  const phone = String(order.phone ?? "").trim();
  if (!phone) {
    console.warn(`[WhatsApp] Order ${order._id} has no phone field — skipping order_cancelled`);
    return;
  }

  const orderId =
    (String(order.orderId ?? "").trim() ||
     `ORD-${String(order._id).slice(-6).toUpperCase()}`).replace(/^#+/, "");

  const reason =
    String(order.cancellationReason ?? "").trim() ||
    "As per operational requirements";

  console.log(
    `[WhatsApp] sendOrderCancelled → orderId=${orderId} customer=${order.customerName} phone=${phone} reason="${reason}"`
  );

  await sendTemplate(
    "fishtokri_order_cancelled",
    phone,
    [
      String(order.customerName ?? "Customer"),
      orderId,
      reason,
    ],
    log
  );
}
