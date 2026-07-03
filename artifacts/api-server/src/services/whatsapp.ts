/**
 * WhatsApp notification service — Admark Verified WhatsApp API
 * Docs: https://verifiedwhatsapp.admarksolution.com
 *
 * Credentials are read from environment variables:
 *   WABA_API_KEY   — API key
 *   WABA_PHONE_ID  — WhatsApp Business phone number ID
 */

const WABA_API_BASE = "https://verifiedwhatsapp.admarksolution.com";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise an Indian mobile number to the 91XXXXXXXXXX format the API
 * expects. Returns null for unrecognised formats (caller skips the send).
 */
function formatPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return null;
}

/**
 * Build the human-readable items block used inside the order-confirmed bill.
 * Each line: "• Item name (unit) × qty — ₹total"
 */
export function buildItemsText(
  items: Array<{ name: string; quantity: number; price: number; unit?: string }>
): string {
  if (!Array.isArray(items) || items.length === 0) return "—";
  return items
    .map((it) => {
      const unit = it.unit ? ` (${it.unit})` : "";
      const lineTotal = (Number(it.price) || 0) * (Number(it.quantity) || 1);
      return `• ${it.name}${unit} x${it.quantity} - Rs.${lineTotal}`;
    })
    .join("\n");
}

type Logger = {
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
  info: (obj: object, msg?: string) => void;
};

/**
 * Core send function.
 * Variables are passed as a URL-encoded JSON object (body1, body2, …)
 * so commas and newlines inside variable values are safe.
 */
async function sendTemplate(
  templateName: string,
  phone: string,
  bodyVars: string[],
  log?: Logger
): Promise<void> {
  const apiKey = process.env.WABA_API_KEY;
  const phoneId = process.env.WABA_PHONE_ID;

  if (!apiKey || !phoneId) {
    (log ?? console).warn(
      { templateName },
      "[WhatsApp] WABA_API_KEY or WABA_PHONE_ID not set — skipping"
    );
    return;
  }

  const formattedPhone = formatPhone(phone);
  if (!formattedPhone) {
    (log ?? console).warn(
      { phone, templateName },
      "[WhatsApp] Unrecognised phone format — skipping"
    );
    return;
  }

  // Build named variable object: { body1: "...", body2: "...", … }
  const varsObj: Record<string, string> = {};
  bodyVars.forEach((v, i) => {
    varsObj[`body${i + 1}`] = String(v ?? "").trim();
  });

  const params = new URLSearchParams({
    "api-key": apiKey,
    templateName,
    phoneNumber: formattedPhone,
    phoneNumberId: phoneId,
    variables: JSON.stringify(varsObj),
  });

  try {
    const resp = await fetch(
      `${WABA_API_BASE}/api/send/bytemplate?${params.toString()}`
    );
    const data = (await resp.json()) as any;
    if (!data.success) {
      (log ?? console).error(
        { templateName, phone: formattedPhone, response: data },
        "[WhatsApp] API returned failure"
      );
    } else {
      (log ?? console).info(
        { templateName, phone: formattedPhone, requestId: data.requestId },
        "[WhatsApp] Message sent"
      );
    }
  } catch (err) {
    (log ?? console).error(
      { err, templateName, phone: formattedPhone },
      "[WhatsApp] HTTP request failed"
    );
  }
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
  if (!phone) return;

  const orderId = `ORD-${String(order._id).slice(-6).toUpperCase()}`;
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
 * Template: fishtokri_out_for_delivery
 * Variables: {{1}} name, {{2}} orderId, {{3}} partner name, {{4}} partner phone
 *
 * NOTE: The COD variant (fishtokri_out_for_delivery_cod) requires a Razorpay
 * payment link. Once Razorpay is integrated, replace this call with the COD
 * template for orders where paymentMode === "cod".
 */
export async function sendOutForDelivery(
  order: any,
  deliveryPersonPhone: string,
  log?: Logger
): Promise<void> {
  const phone = String(order.phone ?? "").trim();
  if (!phone) return;

  const orderId = `ORD-${String(order._id).slice(-6).toUpperCase()}`;
  const dpName =
    String(order.assignedDeliveryPersonName ?? "").trim() ||
    "Our delivery partner";
  const dpPhone = deliveryPersonPhone.trim() || "—";

  await sendTemplate(
    "fishtokri_out_for_delivery",
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

/**
 * Fires when an order is cancelled from the backend (status → cancelled).
 * Template: fishtokri_order_cancelled
 * Variables: {{1}} name, {{2}} orderId, {{3}} reason
 */
export async function sendOrderCancelled(order: any, log?: Logger): Promise<void> {
  const phone = String(order.phone ?? "").trim();
  if (!phone) return;

  const orderId = `ORD-${String(order._id).slice(-6).toUpperCase()}`;
  const reason =
    String(order.cancellationReason ?? "").trim() ||
    "As per operational requirements";

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
