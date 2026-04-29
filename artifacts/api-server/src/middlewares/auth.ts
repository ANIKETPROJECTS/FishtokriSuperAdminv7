import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET;

if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET must be set.");
}

export interface AuthenticatedRequest extends Request {
  admin?: {
    adminId: string;
    email: string;
    role?: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Authentication token required" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { adminId: string; email: string; role?: string };
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
  }
}

export function requireMasterAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.admin?.role !== "master_admin") {
    res.status(403).json({ error: "Forbidden", message: "Master Admin access required" });
    return;
  }
  next();
}
