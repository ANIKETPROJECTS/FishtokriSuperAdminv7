import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const hubStatusEnum = ["Active", "Inactive"] as const;

export const hubsTable = pgTable("hubs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull().default(""),
  serviceAreas: jsonb("service_areas").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHubSchema = createInsertSchema(hubsTable)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().min(1, "Hub name is required"),
    location: z.string().default(""),
    serviceAreas: z.array(z.string()).default([]),
    status: z.enum(["Active", "Inactive"]).default("Active"),
  });

export const updateHubSchema = insertHubSchema.partial();

export type InsertHub = z.infer<typeof insertHubSchema>;
export type UpdateHub = z.infer<typeof updateHubSchema>;
export type Hub = typeof hubsTable.$inferSelect;
