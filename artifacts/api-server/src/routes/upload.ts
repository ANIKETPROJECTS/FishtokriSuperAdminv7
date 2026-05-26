import { Router, type IRouter } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();
router.use(requireAuth as any);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "ValidationError", message: "No image file provided" });
      return;
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      req.log.error({ cloudName: !!cloudName, apiKey: !!apiKey, apiSecret: !!apiSecret }, "Cloudinary credentials missing");
      res.status(500).json({ error: "ConfigError", message: "Image upload service is not configured" });
      return;
    }

    const instance = cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    req.log.info({ cloud_name: instance.cloud_name, api_key: instance.api_key, has_secret: !!instance.api_secret }, "Cloudinary config loaded");

    const folder = (req.query.folder as string) || "fishtokri";

    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: "image" },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
      stream.end(req.file!.buffer);
    });

    res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (err: any) {
    req.log.error({ err }, "Failed to upload image");
    res.status(500).json({ error: "UploadError", message: err.message || "Failed to upload image" });
  }
});

export default router;
