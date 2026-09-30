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

export interface RazorpayPaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  created_at?: number;
  contact?: string;
  email?: string;
  order_id?: string | null;
  invoice_id?: string | null;
  description?: string | null;
  refund_status?: string | null;
  amount_refunded?: number;
  captured?: boolean;
  fee?: number | null;
  tax?: number | null;
  error_code?: string | null;
  error_description?: string | null;
  acquirer_data?: {
    rrn?: string;
    bank_transaction_id?: string;
    [key: string]: unknown;
  };
  notes?: Record<string, unknown>;
}

export interface RazorpayPaymentsPage {
  items: RazorpayPaymentRecord[];
  count: number;
}

export class RazorpayApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 502,
  ) {
    super(message);
    this.name = "RazorpayApiError";
  }
}

/**
 * Reads one page of payments from Razorpay. Credentials are only used here on
 * the API server and are never returned to the admin client or included in logs.
 */
export async function listPayments(params: {
  count: number;
  skip: number;
  from?: number;
  to?: number;
}): Promise<RazorpayPaymentsPage> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new RazorpayApiError(
      "Razorpay API credentials are not configured.",
      503,
    );
  }

  const query = new URLSearchParams({
    count: String(params.count),
    skip: String(params.skip),
  });
  if (params.from !== undefined) query.set("from", String(params.from));
  if (params.to !== undefined) query.set("to", String(params.to));

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${RAZORPAY_API}/payments?${query.toString()}`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: controller.signal,
    });

    const data: any = await response.json().catch(() => null);

    if (response.status === 401 || response.status === 403) {
      throw new RazorpayApiError(
        "Razorpay rejected the configured credentials. Check the API key ID and secret.",
        502,
      );
    }
    if (!response.ok) {
      throw new RazorpayApiError(
        response.status === 429
          ? "Razorpay is temporarily rate-limiting requests. Try again shortly."
          : `Razorpay could not return transactions (HTTP ${response.status}).`,
        response.status === 429 ? 503 : 502,
      );
    }

    if (!Array.isArray(data?.items)) {
      throw new RazorpayApiError("Razorpay returned an unexpected transactions response.");
    }

    return {
      items: data.items as RazorpayPaymentRecord[],
      count: Number.isFinite(Number(data.count)) ? Number(data.count) : data.items.length,
    };
  } catch (error) {
    if (error instanceof RazorpayApiError) throw error;
    if ((error as Error)?.name === "AbortError") {
      throw new RazorpayApiError("Razorpay did not respond in time. Try again.");
    }
    throw new RazorpayApiError("Could not connect to Razorpay. Try again.");
  } finally {
    clearTimeout(timer);
  }
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
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    (log ?? console).warn(
      { orderId: order._id },
      "[Razorpay] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set — skipping payment link creation"
    );
    return null;
  }

  const orderId = String(order.orderId ?? "").trim() || String(order._id);
  const dueAmount = Number(order.dueAmount ?? order.total ?? 0);

  if (dueAmount <= 0) {
    (log ?? console).warn(
      { orderId },
      "[Razorpay] dueAmount is 0 — skipping payment link creation"
    );
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
      (log ?? console).error(
        { orderId, status: resp.status, error: data },
        "[Razorpay] Payment link creation failed"
      );
      console.error(
        `[Razorpay] Failed to create payment link for order ${orderId}: ${resp.status} ${JSON.stringify(data)}`
      );
      return null;
    }

    const shortUrl = String(data.short_url ?? "").trim();
    console.log(
      `[Razorpay] Payment link created for order ${orderId}: ${shortUrl} (amount=₹${dueAmount})`
    );
    (log ?? console).info(
      { orderId, shortUrl, amount: dueAmount, linkId: data.id },
      "[Razorpay] Payment link created"
    );
    return shortUrl || null;
  } catch (err: any) {
    (log ?? console).error(
      { orderId, err },
      "[Razorpay] Payment link creation error"
    );
    console.error(`[Razorpay] Error creating payment link for order ${orderId}: ${String(err)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
