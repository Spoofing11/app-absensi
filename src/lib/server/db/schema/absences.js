import {
  date,
  index,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { users } from "./users.js";
import { projects } from "./projects.js";
import { projectAssignments } from "./project-assignments.js";

export const absences = mysqlTable(
  "absences",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workDate: date("work_date", { mode: "string" }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    note: text("note"),
    employeeType: varchar("employee_type", { length: 20 }).notNull(),
    assignmentId: varchar("assignment_id", { length: 36 }).references(
      () => projectAssignments.id,
      { onDelete: "restrict" },
    ),
    projectId: varchar("project_id", { length: 36 }).references(
      () => projects.id,
      { onDelete: "restrict" },
    ),
    projectName: varchar("project_name", { length: 150 }),
    projectCode: varchar("project_code", { length: 30 }),
    name: varchar("full_name", { length: 150 }).notNull(),
    username: varchar("username", { length: 100 }).notNull(),
    userCode: varchar("user_code", { length: 30 }).notNull(),
    roleId: varchar("role_id", { length: 36 }),
    roleName: varchar("role_name", { length: 100 }),
    legacyRole: varchar("legacy_role", { length: 20 }).notNull(),
    timezone: varchar("timezone", { length: 100 }).notNull(),
    scheduleName: varchar("schedule_name", { length: 100 }),
    scheduledStartAt: timestamp("scheduled_start_at", { mode: "date" }),
    scheduledEndAt: timestamp("scheduled_end_at", { mode: "date" }),
    createdById: varchar("created_by_id", { length: 36 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (table) => [
    uniqueIndex("absences_user_date_unique").on(table.userId, table.workDate),
    index("absences_date_project_idx").on(table.workDate, table.projectId),
    index("absences_assignment_idx").on(table.assignmentId),
  ],
);
