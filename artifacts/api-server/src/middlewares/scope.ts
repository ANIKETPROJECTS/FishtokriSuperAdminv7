import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { HubUser } from "../db/models/hub-user.js";
import { SubHub } from "../db/models/sub-hub.js";
import type { AuthenticatedRequest } from "./auth.js";

export interface UserScope {
  role: string;
  isMaster: boolean;
  // For non-master users: the super hub IDs they own / belong to (string form).
  superHubIds: string[];
  // For non-master users: the sub hub IDs they have access to (string form).
  // For super_hub users this is the union of (a) all sub hubs under their
  // assigned super hubs and (b) any sub hubs explicitly assigned to them.
  // For sub_hub users it is exactly their assigned sub hubs.
  subHubIds: string[];
}

export interface ScopedRequest extends AuthenticatedRequest {
  scope?: UserScope;
}

function toIdStr(v: any): string {
  return v == null ? "" : String(v);
}

/**
 * Loads the authenticated user's hub scope onto `req.scope`.
 *
 * Must be used **after** `requireAuth`. Master admins receive an empty scope
 * with `isMaster: true` (i.e. no filtering).
 */
export async function loadScope(
  req: ScopedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const role = req.admin?.role || "";

    if (role === "master_admin") {
      req.scope = {
        role,
        isMaster: true,
        superHubIds: [],
        subHubIds: [],
      };
      return next();
    }

    const adminId = req.admin?.adminId;
    if (!adminId || !mongoose.isValidObjectId(adminId)) {
      // Authenticated but not a real DB-backed user (and not master) — deny.
      res.status(401).json({ error: "Unauthorized", message: "User not found" });
      return;
    }

    const user = await HubUser.findById(adminId).lean();
    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "User not found" });
      return;
    }

    const superHubIds: string[] = (
      Array.isArray((user as any).superHubIds) && (user as any).superHubIds.length > 0
        ? (user as any).superHubIds
        : (user as any).superHubId
          ? [(user as any).superHubId]
          : []
    ).map(toIdStr).filter(Boolean);

    const explicitSubHubIds: string[] = (
      Array.isArray((user as any).subHubIds) && (user as any).subHubIds.length > 0
        ? (user as any).subHubIds
        : (user as any).subHubId
          ? [(user as any).subHubId]
          : []
    ).map(toIdStr).filter(Boolean);

    let subHubIds = [...explicitSubHubIds];

    if (role === "super_hub" && superHubIds.length > 0) {
      // Expand to every sub hub under the user's super hubs.
      const subs = await SubHub.find(
        { superHubId: { $in: superHubIds } },
        { _id: 1 },
      ).lean();
      for (const s of subs) subHubIds.push(toIdStr(s._id));
      subHubIds = Array.from(new Set(subHubIds));
    }

    let resolvedSuperHubIds = superHubIds;
    if (role === "sub_hub" && resolvedSuperHubIds.length === 0 && subHubIds.length > 0) {
      // Derive the parent super hub(s) from the assigned sub hubs.
      const subs = await SubHub.find(
        { _id: { $in: subHubIds } },
        { superHubId: 1 },
      ).lean();
      resolvedSuperHubIds = Array.from(
        new Set(subs.map((s: any) => toIdStr(s.superHubId)).filter(Boolean)),
      );
    }

    req.scope = {
      role,
      isMaster: false,
      superHubIds: resolvedSuperHubIds,
      subHubIds,
    };
    next();
  } catch (err) {
    res.status(500).json({ error: "InternalError", message: "Failed to load scope" });
  }
}

/**
 * Helper: convert a list of string ObjectIds to ObjectId instances, ignoring
 * any invalid entries. Useful when filtering by `_id` against a scope set.
 */
export function toObjectIds(ids: string[]): mongoose.Types.ObjectId[] {
  const out: mongoose.Types.ObjectId[] = [];
  for (const id of ids) {
    if (mongoose.isValidObjectId(id)) out.push(new mongoose.Types.ObjectId(id));
  }
  return out;
}

/**
 * Returns true if the given sub hub id is accessible by the scope.
 * Master admins always have access.
 */
export function canAccessSubHub(scope: UserScope | undefined, subHubId: string): boolean {
  if (!scope) return false;
  if (scope.isMaster) return true;
  return scope.subHubIds.includes(String(subHubId));
}

/**
 * Returns true if the given super hub id is accessible by the scope.
 * Master admins always have access.
 */
export function canAccessSuperHub(scope: UserScope | undefined, superHubId: string): boolean {
  if (!scope) return false;
  if (scope.isMaster) return true;
  return scope.superHubIds.includes(String(superHubId));
}

/**
 * Express middleware: rejects the request with 403 unless the authenticated
 * user is the Master Admin. Must be mounted **after** `loadScope`.
 */
export function denyIfNotMaster(
  req: ScopedRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.scope?.isMaster) {
    next();
    return;
  }
  res.status(403).json({ error: "Forbidden", message: "Master Admin access required" });
}

/**
 * Inline helper version of `denyIfNotMaster` for use inside route handlers
 * where the master-only check applies only to part of the logic. Returns
 * true (and writes a 403 response) when the request was rejected.
 */
export function rejectIfNotMaster(scope: UserScope | undefined, res: Response): boolean {
  if (scope?.isMaster) return false;
  res.status(403).json({ error: "Forbidden", message: "Master Admin access required" });
  return true;
}
