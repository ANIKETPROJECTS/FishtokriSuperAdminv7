import { Router, type IRouter } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();
router.use(requireAuth as any);

/**
 * Images are stored at <project-root>/Images/<folder>/<timestamp>-<random>.<ext>
 * and served statically at /images/<folder>/... by app.ts
 */
const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const folder = (req.query.folder as string) || "uploads";
    const dest = path.join(process.cwd(), "Images", folder);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname) || ".jpg";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

router.post("/", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "ValidationError", message: "No image file provided" });
      return;
    }

    const folder = (req.query.folder as string) || "uploads";
    const relativePath = `/images/${folder}/${req.file.filename}`;

    // If BASE_URL is set (e.g. on VPS: "http://187.127.174.48:3015"), return an
    // absolute URL so other apps can use it directly without any proxy/nginx config.
    const baseUrl = (process.env.BASE_URL || "").replace(/\/$/, "");
    const url = baseUrl ? `${baseUrl}${relativePath}` : relativePath;

    req.log.info({ url, size: req.file.size }, "Image saved to local storage");
    res.json({ url });
  } catch (err: any) {
    req.log.error({ err }, "Failed to save image");
    res.status(500).json({ error: "UploadError", message: err.message || "Failed to save image" });
  }
});

export default router;
