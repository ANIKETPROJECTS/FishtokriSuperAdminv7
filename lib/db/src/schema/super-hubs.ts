import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const superHubsTable = pgTable("super_hubs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SuperHub = typeof superHubsTable.$inferSelect;
