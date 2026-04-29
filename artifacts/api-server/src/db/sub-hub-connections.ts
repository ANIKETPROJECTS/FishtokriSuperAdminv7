import mongoose from "mongoose";
import { logger } from "../lib/logger.js";

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI must be set.");
}

const BASE_URI = process.env.MONGODB_URI;
const connectionCache = new Map<string, mongoose.Connection>();

function buildUri(dbName: string): string {
  const url = new URL(BASE_URI);
  url.pathname = `/${dbName}`;
  return url.toString();
}

export async function getSubHubDbConnection(dbName: string): Promise<mongoose.Connection> {
  if (connectionCache.has(dbName)) {
    const conn = connectionCache.get(dbName)!;
    if (conn.readyState === 1) return conn;
    connectionCache.delete(dbName);
  }
  const uri = buildUri(dbName);
  const conn = await mongoose.createConnection(uri).asPromise();
  connectionCache.set(dbName, conn);
  logger.info({ dbName }, "Connected to sub hub DB");
  return conn;
}

export function generateDbName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
}
