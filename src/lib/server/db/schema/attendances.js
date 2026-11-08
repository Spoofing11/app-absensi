import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  int,
  mysqlTable,
  timestamp,
  text,
  varchar,
} from "drizzle-orm/mysql-core";
import { mediaFiles } from "./media-files.js";
import { projectAssignments } from "./project-assignments.js";
import { projects } from "./projects.js";
import { users } from "./users.js";
import { workSchedules } from "./work-schedules.js";

/**
 * Satu rangkaian absen masuk + keluar.
 *
 * Unique (user_id, work_date) TIDAK dipasang karena aturan "satu catatan per
 * tanggal kerja" masih berstatus Usulan (AB-03). Index non-unik disiapkan
 * untuk query riwayat.
 *
 * Salinan historis (snapshot) menyimpan nilai saat absensi dicatat sehingga
 * perubahan master tidak mengubah riwayat.
 */
export const attendances = mysqlTable(
  "attendances",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    attendanceCode: varchar("attendance_code", { length: 30 })
      .notNull()
      .unique(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    workDate: date("work_date", { mode: "string" }).notNull(),

    workScheduleId: varchar("work_schedule_id", { length: 36 })
      .notNull()
      .references(() => workSchedules.id, { onDelete: "restrict" }),
    projectAssignmentId: varchar("project_assignment_id", {
      length: 36,
    }).references(() => projectAssignments.id, { onDelete: "restrict" }),
    projectId: varchar("project_id", { length: 36 }).references(
      () => projects.id,
      { onDelete: "restrict" },
    ),

    userCodeSnapshot: varchar("user_code_snapshot", { length: 30 }).notNull(),
    fullNameSnapshot: varchar("full_name_snapshot", { length: 150 }).notNull(),
    roleIdSnapshot: varchar("role_id_snapshot", { length: 36 }),
    roleNameSnapshot: varchar("role_name_snapshot", { length: 100 }),
    earlyReasonCategory: varchar("early_reason_category", { length: 40 }),
    earlyReasonText: text("early_reason_text"),
    earlySeconds: int("early_seconds").notNull().default(0),
    roleSnapshot: varchar("role_snapshot", { length: 20 }).notNull(),
    scheduleCodeSnapshot: varchar("schedule_code_snapshot", {
      length: 30,
    }).notNull(),
    scheduleNameSnapshot: varchar("schedule_name_snapshot", {
      length: 100,
    }).notNull(),
    timezoneSnapshot: varchar("timezone_snapshot", { length: 100 }).notNull(),
    projectCodeSnapshot: varchar("project_code_snapshot", { length: 30 }),
    projectNameSnapshot: varchar("project_name_snapshot", { length: 150 }),

    scheduledStartAt: timestamp("scheduled_start_at", {
      mode: "date",
    }).notNull(),
    scheduledEndAt: timestamp("scheduled_end_at", {
      mode: "date",
    }).notNull(),

    checkInAt: timestamp("check_in_at", { mode: "date" }).notNull(),
    checkInPhotoId: varchar("check_in_photo_id", { length: 36 }).references(
      () => mediaFiles.id,
      { onDelete: "restrict" },
    ),
    checkOutAt: timestamp("check_out_at", { mode: "date" }),
    checkOutPhotoId: varchar("check_out_photo_id", { length: 36 }).references(
      () => mediaFiles.id,
      { onDelete: "restrict" },
    ),

    employeeTypeSnapshot: varchar("employee_type_snapshot", { length: 20 }),
    usernameSnapshot: varchar("username_snapshot", { length: 100 }),
    workType: varchar("work_type", { length: 20 }),
    reportedProjectId: varchar("reported_project_id", {
      length: 36,
    }).references(() => projects.id, { onDelete: "restrict" }),
    reportedProjectName: varchar("reported_project_name", { length: 150 }),
    approvalStatus: varchar("approval_status", { length: 20 })
      .notNull()
      .default("legacy"),
    approvalReason: text("approval_reason"),
    reviewedById: varchar("reviewed_by_id", { length: 36 }),
    reviewedByName: varchar("reviewed_by_name", { length: 150 }),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    workNote: text("work_note"),
    lateSeconds: int("late_seconds").notNull().default(0),

    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (table) => [
    index("attendances_approval_date_idx").on(
      table.approvalStatus,
      table.workDate,
    ),
    index("attendances_role_snapshot_date_idx").on(
      table.roleIdSnapshot,
      table.workDate,
    ),
    index("attendances_user_date_idx").on(table.userId, table.workDate),
    index("attendances_work_date_idx").on(table.workDate),
    index("attendances_project_date_idx").on(table.projectId, table.workDate),
    index("attendances_schedule_date_idx").on(
      table.workScheduleId,
      table.workDate,
    ),
    index("attendances_role_date_idx").on(table.roleSnapshot, table.workDate),
    check("attendances_late_seconds_check", sql`${table.lateSeconds} >= 0`),
    check(
      "attendances_checkout_after_checkin_check",
      sql`${table.checkOutAt} is null or ${table.checkOutAt} >= ${table.checkInAt}`,
    ),
  ],
);
