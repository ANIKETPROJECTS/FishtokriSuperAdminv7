import mongoose from "mongoose";
import { logger } from "../lib/logger.js";

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI must be set.");
}

const BASE_URI = process.env.MONGODB_URI;

let customersConn: mongoose.Connection | null = null;

function buildUri(dbName: string): string {
  const url = new URL(BASE_URI);
  url.pathname = `/${dbName}`;
  return url.toString();
}

export async function getCustomersConnection(): Promise<mongoose.Connection> {
  if (customersConn && customersConn.readyState === 1) return customersConn;
  const uri = buildUri("customers");
  customersConn = await mongoose.createConnection(uri).asPromise();
  logger.info("Connected to customers DB");
  return customersConn;
}
