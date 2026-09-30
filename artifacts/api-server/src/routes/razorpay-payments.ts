import { Router } from "express";
import { requireAuth, requireMasterAdmin } from "../middlewares/auth.js";
import { listPayments, RazorpayApiError } from "../services/razorpay.js";

const router = Router();

router.use(requireAuth as any);
router.use(requireMasterAdmin as any);

function parseInteger(value: unknown, fallback: number): number | null {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

// GET /api/razorpay-payments?count=100&skip=0&from=<epoch>&to=<epoch>
router.get("/razorpay-payments", async (req, res) => {
  const count = parseInteger(req.query.count, 100);
  const skip = parseInteger(req.query.skip, 0);
  const from = parseInteger(req.query.from, -1);
  const to = parseInteger(req.query.to, -1);

  if (count === null || count < 1 || count > 100) {
    res.status(400).json({ message: "count must be between 1 and 100." });
    return;
  }
  if (skip === null) {
    res.status(400).json({ message: "skip must be a non-negative integer." });
    return;
  }
  if (from === null || to === null) {
    res.status(400).json({ message: "Date filters must be valid Unix timestamps." });
    return;
  }
  if (from !== -1 && to !== -1 && from > to) {
    res.status(400).json({ message: "The start date must be before the end date." });
    return;
  }

  try {
    const result = await listPayments({
      count,
      skip,
      ...(from === -1 ? {} : { from }),
      ...(to === -1 ? {} : { to }),
    });
    res.json({
      items: result.items,
      count: result.count,
      skip,
      pageSize: count,
      hasMore: result.items.length === count,
    });
  } catch (error) {
    if (error instanceof RazorpayApiError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(502).json({ message: "Could not load Razorpay transactions." });
  }
});

export default router;