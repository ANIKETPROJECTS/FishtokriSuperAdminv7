/**
 * Razorpay Payment Links service
 * Docs: https://razorpay.com/docs/payments/payment-links/apis/
 *
 * Credentials: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (Replit secrets)
 *
 * Creates a payment link for a COD order so the customer can pay online
 * before the delivery partner arrives. The short_url is stored on the
 * order document and embedded in the out-for-delivery WhatsApp message.
 */

const RAZORPAY_API = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 10_000;

type Logger = {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
};

export interface RazorpayPaymentLink {
  id: string;
  short_url: string;
  amount: number;
  status: string;
}

/**
 * Creates a Razorpay Payment Link for the given order and returns the short URL.
 * Returns null if credentials are missing or the API call fails (caller falls back
 * to the fishtokri.com URL so the WhatsApp message still goes out).
 */
export async function createPaymentLink(
  order: any,
  log?: Logger
): Promise<string | null> {
  const activeLog: Logger = log ?? {
    info: () => {},
    warn: () => {},
    error: (obj, message) => console.error(message, obj),
  };
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  const orderId = String(order.orderId ?? "").trim() || String(order._id);
  const dueAmount = Number(order.dueAmount ?? order.total ?? 0);

  if (dueAmount <= 0) {
    return null;
  }

  const amountPaise = Math.round(dueAmount * 100); // Razorpay expects paise

  const customerPhone = String(order.phone ?? "").replace(/\D/g, "");
  const customerName = String(order.customerName ?? "Customer").trim();

  const body = {
    amount: amountPaise,
    currency: "INR",
    accept_partial: false,
    description: `FishTokri order #${orderId}`,
    customer: {
      name: customerName,
      contact: customerPhone ? `+91${customerPhone.slice(-10)}` : undefined,
    },
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: {
      orderId,
      source: "fishtokri_admin",
    },
  };

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(`${RAZORPAY_API}/payment_links`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data: any = await resp.json();

    if (!resp.ok) {
      activeLog.error(
        { orderId, status: resp.status, error: data },
        "[Razorpay] Payment link creation failed"
      );
      return null;
    }

    const shortUrl = String(data.short_url ?? "").trim();
    return shortUrl || null;
  } catch (err: any) {
    activeLog.error(
      { orderId, err },
      "[Razorpay] Payment link creation error"
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}
