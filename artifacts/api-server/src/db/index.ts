import mongoose from "mongoose";
import { logger } from "../lib/logger.js";

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI must be set.");
}

const BASE_URI = process.env.MONGODB_URI;

function buildUri(base: string, dbName: string): string {
  const url = new URL(base);
  url.pathname = `/${dbName}`;
  return url.toString();
}

const uri = buildUri(BASE_URI, "fishtokri_admin");

let connected = false;

export async function connectDB() {
  if (connected) return;
  await mongoose.connect(uri);
  connected = true;
  logger.info("Connected to MongoDB (fishtokri_admin)");
}

export { mongoose };
