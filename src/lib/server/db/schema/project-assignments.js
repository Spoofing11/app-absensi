import {
  date,
  index,
  uniqueIndex,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { projects } from "./projects.js";
import { users } from "./users.js";
// workDate is null only for archived placements imported from the old model.

export const projectAssignments = mysqlTable(
  "project_assignments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    assignmentCode: varchar("assignment_code", { length: 30 })
      .notNull()
      .unique(),
    workerId: varchar("worker_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    projectId: varchar("project_id", { length: 36 })
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    // Legacy dates are retained for history; daily scheduling uses workDate.
    startDate: date("start_date", { mode: "string" }),
    // Retained only for audit of placements ended before daily scheduling.
    endedAt: timestamp("ended_at", { mode: "date" }),
    workDate: date("work_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    notes: text("notes"),
    createdById: varchar("created_by_id", { length: 36 }).notNull(),
    updatedById: varchar("updated_by_id", { length: 36 }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (table) => [
    uniqueIndex("project_assignments_worker_date_unique").on(
      table.workerId,
      table.workDate,
    ),
    index("project_assignments_date_project_idx").on(
      table.workDate,
      table.projectId,
    ),
    index("project_assignments_worker_start_idx").on(
      table.workerId,
      table.startDate,
    ),
    index("project_assignments_project_start_idx").on(
      table.projectId,
      table.startDate,
    ),
  ],
);
