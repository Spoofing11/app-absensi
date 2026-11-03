import {
  boolean,
  mysqlTable,
  text,
  time,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const workSchedules = mysqlTable("work_schedules", {
  id: varchar("id", { length: 36 }).primaryKey(),
  scheduleCode: varchar("schedule_code", { length: 30 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdById: varchar("created_by_id", { length: 36 }),
  updatedById: varchar("updated_by_id", { length: 36 }),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .onUpdateNow(),
});
