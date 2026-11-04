import { index, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const activityLogs = mysqlTable("activity_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  actorName: varchar("actor_name", { length: 150 }).notNull(),
  actorUsername: varchar("actor_username", { length: 100 }).notNull(),
  feature: varchar("feature", { length: 32 }).notNull(),
  action: varchar("action", { length: 32 }).notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("activity_logs_time_idx").on(table.createdAt, table.id),
  index("activity_logs_filter_idx").on(table.feature, table.action, table.createdAt),
]);
