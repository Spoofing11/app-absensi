import "server-only";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/server/db";
import { absences, attendances } from "@/lib/server/db/schema";
import { env } from "@/lib/server/env";
import { requirePermission } from "@/lib/server/auth/permissions";

export function parseFilters(params = {}) {
  const today = formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd");
  const filter = z
    .object({
      from: z.iso.date(),
      to: z.iso.date(),
      q: z.string().trim().max(100),
      role: z.string().max(180),
      project: z.string().max(36),
      status: z.enum([
        "",
        "late",
        "early",
        "open",
        "complete",
        "sick",
        "leave",
        "unexcused",
        "present",
      ]),
      view: z.enum(["detail", "recap"]),
      page: z.coerce.number().int().min(1).max(100000),
    })
    .parse({
      from: params.from || today.slice(0, 8) + "01",
      to: params.to || today,
      q: params.q || "",
      role: params.role || "",
      project: params.project || "",
      status: params.status || "",
      view: params.view || "detail",
      page: params.page || 1,
    });
  if (
    filter.from > filter.to ||
    (new Date(filter.to) - new Date(filter.from)) / 86400000 > 366
  )
    throw new Error("Pilih rentang tanggal yang valid, maksimal 366 hari.");
  return filter;
}

// The same union and filter feed the list, recaps, and the complete Excel export.
function records(f) {
  return sql`
    SELECT a.id, a.user_id AS userId,
      CONVERT(CASE WHEN a.role_id_snapshot IS NOT NULL AND a.role_name_snapshot IS NOT NULL
        THEN CONCAT('role:', a.role_id_snapshot, ':', a.role_name_snapshot)
        ELSE CONCAT('legacy:', a.role_snapshot) END USING utf8mb4) COLLATE utf8mb4_bin AS groupKey,
      COALESCE(a.role_name_snapshot, CONCAT('Data lama · ', a.role_snapshot)) AS groupLabel,
      a.full_name_snapshot AS name, a.user_code_snapshot AS code, a.username_snapshot AS username,
      CAST(a.work_date AS CHAR) AS date, a.project_id AS projectId, a.project_name_snapshot AS project,
      a.project_code_snapshot AS projectCode, a.check_in_at AS checkIn, a.check_out_at AS checkOut,
      a.timezone_snapshot AS timezone, a.late_seconds AS lateSeconds, a.early_seconds AS earlySeconds,
      a.schedule_name_snapshot AS scheduleName, a.scheduled_start_at AS scheduledStart,
      a.scheduled_end_at AS scheduledEnd, a.early_reason_category AS earlyReason,
      a.early_reason_text AS earlyReasonText, a.work_type AS workType, a.work_note AS workNote,
      COALESCE(a.employee_type_snapshot, CASE WHEN a.role_snapshot IN ('karyawan', 'tukang') THEN a.role_snapshot ELSE NULL END) AS employeeType, NULL AS absenceStatus, NULL AS note
    FROM attendances a WHERE a.work_date >= ${f.from} AND a.work_date <= ${f.to}
    UNION ALL
    SELECT n.id, n.user_id,
      CONVERT(CASE WHEN n.role_id IS NOT NULL AND n.role_name IS NOT NULL
        THEN CONCAT('role:', n.role_id, ':', n.role_name)
        ELSE CONCAT('legacy:', n.legacy_role) END USING utf8mb4) COLLATE utf8mb4_bin,
      COALESCE(n.role_name, CONCAT('Data lama · ', n.legacy_role)), n.full_name, n.user_code, n.username,
      CAST(n.work_date AS CHAR), n.project_id, n.project_name, n.project_code, NULL, NULL,
      n.timezone, 0, 0, n.schedule_name, n.scheduled_start_at, n.scheduled_end_at, NULL, NULL,
      CASE WHEN n.project_id IS NOT NULL THEN 'project' ELSE NULL END, NULL,
      n.employee_type, n.status, n.note
    FROM absences n WHERE n.work_date >= ${f.from} AND n.work_date <= ${f.to}
      AND NOT EXISTS (SELECT 1 FROM attendances a WHERE a.user_id = n.user_id AND a.work_date = n.work_date)
  `;
}
function condition(f) {
  const conditions = [sql`1 = 1`];
  if (f.role) conditions.push(sql`r.groupKey = ${f.role}`);
  if (f.project) conditions.push(sql`r.projectId = ${f.project}`);
  if (f.q)
    conditions.push(
      sql`(LOCATE(LOWER(${f.q}), LOWER(r.name)) > 0 OR LOCATE(LOWER(${f.q}), LOWER(r.code)) > 0)`,
    );
  if (["sick", "leave", "unexcused"].includes(f.status))
    conditions.push(sql`r.absenceStatus = ${f.status}`);
  if (f.status === "present") conditions.push(sql`r.checkIn IS NOT NULL`);
  if (f.status === "late") conditions.push(sql`r.lateSeconds > 0`);
  if (f.status === "early") conditions.push(sql`r.earlySeconds > 0`);
  if (f.status === "open")
    conditions.push(sql`r.checkIn IS NOT NULL AND r.checkOut IS NULL`);
  if (f.status === "complete") conditions.push(sql`r.checkOut IS NOT NULL`);
  return sql.join(conditions, sql` AND `);
}

export async function exportHistoryRows(params) {
  await requirePermission("history", "read");
  const filters = parseFilters(params);
  const [rows] = await db.execute(
    sql`SELECT r.* FROM (${records(filters)}) r WHERE ${condition(filters)} ORDER BY r.date DESC, r.name, r.id`,
  );
  return { filters, rows };
}

export async function historyData(params) {
  await requirePermission("history", "read");
  const f = parseFilters(params);
  const source = records(f);
  const where = condition(f);
  const [roleOptions] = await db.execute(
    sql`SELECT DISTINCT r.groupKey AS \`key\`, r.groupLabel AS label FROM (${source}) r ORDER BY label`,
  );
  const [projectOptions] = await db.execute(
    sql`SELECT r.projectId AS id, MAX(r.project) AS name FROM (${source}) r WHERE r.projectId IS NOT NULL GROUP BY r.projectId ORDER BY name`,
  );
  const [groups] = await db.execute(
    sql`SELECT r.groupKey AS \`key\`, r.groupLabel AS label, COUNT(*) AS records, COUNT(DISTINCT r.userId) AS users FROM (${source}) r WHERE ${where} GROUP BY r.groupKey, r.groupLabel ORDER BY label`,
  );
  const [[result]] = await db.execute(
    f.view === "detail"
      ? sql`SELECT COUNT(*) AS total FROM (${source}) r WHERE ${where}`
      : sql`SELECT COUNT(*) AS total FROM (SELECT r.groupKey, r.userId FROM (${source}) r WHERE ${where} GROUP BY r.groupKey, r.userId) totals`,
  );
  const total = Number(result.total);
  const pages = Math.max(1, Math.ceil(total / 25));
  f.page = Math.min(f.page, pages);
  const offset = (f.page - 1) * 25;
  const [rows] = await db.execute(
    f.view === "detail"
      ? sql`SELECT r.* FROM (${source}) r WHERE ${where} ORDER BY r.groupLabel, r.date DESC, r.checkIn DESC, r.id LIMIT 25 OFFSET ${offset}`
      : sql`SELECT r.groupKey, r.groupLabel, r.userId, MAX(r.name) AS name, MAX(r.code) AS code,
        COUNT(DISTINCT CASE WHEN r.checkIn IS NOT NULL THEN r.date END) AS days,
        COUNT(DISTINCT CASE WHEN r.lateSeconds > 0 THEN r.date END) AS lateDays,
        SUM(r.lateSeconds) AS lateSeconds,
        SUM(CASE WHEN r.checkIn IS NOT NULL AND r.checkOut IS NULL THEN 1 ELSE 0 END) AS \`open\`,
        SUM(CASE WHEN r.earlySeconds > 0 THEN 1 ELSE 0 END) AS early,
        SUM(CASE WHEN r.checkOut IS NOT NULL THEN TIMESTAMPDIFF(SECOND, r.checkIn, r.checkOut) ELSE 0 END) AS duration,
        SUM(CASE WHEN r.absenceStatus = 'sick' THEN 1 ELSE 0 END) AS sick,
        SUM(CASE WHEN r.absenceStatus = 'leave' THEN 1 ELSE 0 END) AS leaveDays,
        SUM(CASE WHEN r.absenceStatus = 'unexcused' THEN 1 ELSE 0 END) AS unexcused
      FROM (${source}) r WHERE ${where} GROUP BY r.groupKey, r.groupLabel, r.userId
      ORDER BY r.groupLabel, name, r.userId LIMIT 25 OFFSET ${offset}`,
  );
  return {
    filters: f,
    rows,
    groups,
    roleOptions,
    projectOptions,
    total,
    pages,
  };
}

export async function historyDetail(rawId) {
  await requirePermission("history", "read");
  const parsed = z.uuid().safeParse(rawId);
  if (!parsed.success) return null;
  const [row] = await db
    .select()
    .from(attendances)
    .where(eq(attendances.id, parsed.data))
    .limit(1);
  if (row) return row;
  const [absence] = await db
    .select()
    .from(absences)
    .where(eq(absences.id, parsed.data))
    .limit(1);
  if (!absence) return null;
  return {
    id: absence.id,
    fullNameSnapshot: absence.name,
    userCodeSnapshot: absence.userCode,
    roleNameSnapshot: absence.roleName,
    roleSnapshot: absence.legacyRole,
    workDate: absence.workDate,
    projectNameSnapshot: absence.projectName,
    scheduleNameSnapshot: absence.scheduleName,
    timezoneSnapshot: absence.timezone,
    scheduledStartAt: absence.scheduledStartAt,
    scheduledEndAt: absence.scheduledEndAt,
    absenceStatus: absence.status,
    note: absence.note,
    checkInAt: null,
    checkOutAt: null,
    lateSeconds: 0,
    earlySeconds: 0,
  };
}
