import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const hubUsersTable = pgTable("hub_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().default(""),
  role: text("role").notNull().default("sub_hub"),
  superHubId: integer("super_hub_id"),
  subHubId: integer("sub_hub_id"),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type HubUser = typeof hubUsersTable.$inferSelect;
