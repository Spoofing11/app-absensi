import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";
import { users } from "./users.js";
import { projectAssignments } from "./project-assignments.js";
export const notifications = mysqlTable(
  "notifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    recipientId: varchar("recipient_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignmentId: varchar("assignment_id", { length: 36 }).references(
      () => projectAssignments.id,
      { onDelete: "set null" },
    ),
    initialKey: varchar("initial_key", { length: 36 }).unique(),
    projectName: varchar("project_name", { length: 150 }).notNull(),
    projectAddress: text("project_address").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    readAt: timestamp("read_at", { mode: "date" }),
  },
  (table) => [
    index("notifications_recipient_created_idx").on(
      table.recipientId,
      table.createdAt,
    ),
    index("notifications_recipient_read_idx").on(
      table.recipientId,
      table.readAt,
    ),
  ],
);
