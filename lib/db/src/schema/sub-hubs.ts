import { pgTable, text, serial, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { superHubsTable } from "./super-hubs";

export const subHubsTable = pgTable("sub_hubs", {
  id: serial("id").primaryKey(),
  superHubId: integer("super_hub_id").notNull().references(() => superHubsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  location: text("location").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  pincodes: jsonb("pincodes").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SubHub = typeof subHubsTable.$inferSelect;
