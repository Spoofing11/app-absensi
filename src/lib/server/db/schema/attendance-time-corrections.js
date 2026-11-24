import {
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { attendances } from "./attendances.js";

export const attendanceTimeCorrections = mysqlTable(
  "attendance_time_corrections",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    attendanceId: varchar("attendance_id", { length: 36 })
      .notNull()
      .references(() => attendances.id, { onDelete: "cascade" }),
    revision: int("revision").notNull(),
    actorUserId: varchar("actor_user_id", { length: 36 }).notNull(),
    actorName: varchar("actor_name", { length: 150 }).notNull(),
    actorUsername: varchar("actor_username", { length: 100 }).notNull(),
    timezone: varchar("timezone", { length: 100 }).notNull(),
    reason: text("reason").notNull(),
    beforeState: json("before_state").notNull(),
    afterState: json("after_state").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("attendance_corrections_revision_idx").on(
      table.attendanceId,
      table.revision,
    ),
  ],
);
