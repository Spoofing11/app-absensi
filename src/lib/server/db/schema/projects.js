import { workSchedules } from "./work-schedules.js";
import {
  date,
  index,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const projects = mysqlTable(
  "projects",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectCode: varchar("project_code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 150 }).notNull(),
    address: text("address").notNull(),
    workScheduleId: varchar("work_schedule_id", { length: 36 }).references(
      () => workSchedules.id,
      { onDelete: "restrict" },
    ),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    plannedStartDate: date("planned_start_date", { mode: "string" }),
    plannedEndDate: date("planned_end_date", { mode: "string" }),
    notes: text("notes"),
    createdById: varchar("created_by_id", { length: 36 }),
    updatedById: varchar("updated_by_id", { length: 36 }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (table) => [index("projects_status_idx").on(table.status)],
);
