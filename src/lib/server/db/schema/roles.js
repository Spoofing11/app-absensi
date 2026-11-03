import { workSchedules } from "./work-schedules.js";
import {
  mysqlTable,
  varchar,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/mysql-core";
export const roles = mysqlTable("roles", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  workScheduleId: varchar("work_schedule_id", { length: 36 }).references(
    () => workSchedules.id,
    { onDelete: "restrict" },
  ),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
export const rolePermissions = mysqlTable(
  "role_permissions",
  {
    roleId: varchar("role_id", { length: 36 })
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    feature: varchar("feature", { length: 40 }).notNull(),
    create: boolean("can_create").notNull().default(false),
    read: boolean("can_read").notNull().default(false),
    edit: boolean("can_edit").notNull().default(false),
    delete: boolean("can_delete").notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.feature] })],
);
