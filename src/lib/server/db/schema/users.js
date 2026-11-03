import { roles } from "./roles.js";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Tabel pengguna aplikasi.
 *
 * Field autentikasi mengikuti skema Better Auth:
 * - `username` & `display_username` ditambahkan oleh plugin username.
 * - Password TIDAK disimpan di tabel ini; hash berada di `accounts.password`.
 * - `username_normalized` adalah generated column dari `lower(username)`.
 *
 * Catatan: FK `work_schedule_id` sengaja tidak dipasang untuk menghindari
 * siklus users -> work_schedules -> users (audit created_by_id).
 */
export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    // Better Auth memakai properti `name`; di database tetap `full_name`.
    name: varchar("full_name", { length: 150 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: varchar("image", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .onUpdateNow(),

    username: varchar("username", { length: 100 }).notNull().unique(),
    displayUsername: varchar("display_username", { length: 100 }),
    usernameNormalized: varchar("username_normalized", { length: 100 })
      .generatedAlwaysAs(sql`lower(\`username\`)`, { mode: "stored" })
      .notNull()
      .unique(),

    userCode: varchar("user_code", { length: 30 }).notNull().unique(),
    roleId: varchar("role_id", { length: 36 }).references(() => roles.id, {
      onDelete: "restrict",
    }),
    attendanceEnabled: boolean("attendance_enabled").notNull().default(true),
    employeeType: varchar("employee_type", { length: 20 })
      .notNull()
      .default("karyawan"),
    role: varchar("role", { length: 20 }).notNull().default("karyawan"),
    isActive: boolean("is_active").notNull().default(true),
    workScheduleId: varchar("work_schedule_id", { length: 36 }),
    phoneNumber: varchar("phone_number", { length: 30 }),
    profilePhotoId: varchar("profile_photo_id", { length: 36 }),

    passwordChangedAt: timestamp("password_changed_at", {
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    createdById: varchar("created_by_id", { length: 36 }),
    updatedById: varchar("updated_by_id", { length: 36 }),
  },
  (table) => [
    index("users_role_active_idx").on(table.role, table.isActive),
    index("users_work_schedule_idx").on(table.workScheduleId),
  ],
);
