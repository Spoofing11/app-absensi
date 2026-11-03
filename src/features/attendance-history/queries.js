import "server-only";
import { and, eq, gte, lte, or, sql, desc, count, isNull } from "drizzle-orm";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/server/db";
import { attendances } from "@/lib/server/db/schema";
import { env } from "@/lib/server/env";
import { requirePermission } from "@/lib/server/auth/permissions";
export const roleKey = sql`CONVERT(CASE WHEN ${attendances.roleIdSnapshot} IS NOT NULL AND ${attendances.roleNameSnapshot} IS NOT NULL THEN CONCAT('role:', ${attendances.roleIdSnapshot}, ':', ${attendances.roleNameSnapshot}) ELSE CONCAT('legacy:', ${attendances.roleSnapshot}) END USING utf8mb4) COLLATE utf8mb4_bin`;
export const roleLabel = sql`COALESCE(${attendances.roleNameSnapshot}, CONCAT('Data lama · ', ${attendances.roleSnapshot}))`;
export function parseFilters(params = {}) {
  const today = formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd");
  const filter = z
    .object({
      from: z.iso.date(),
      to: z.iso.date(),
      q: z.string().trim().max(100),
      role: z.string().max(180),
      project: z.string().max(36),
      status: z.enum(["", "late", "early", "open", "complete"]),
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
function condition(f) {
  const conditions = [
    gte(attendances.workDate, f.from),
    lte(attendances.workDate, f.to),
  ];
  if (f.role) conditions.push(sql`${roleKey} = ${f.role}`);
  if (f.project) conditions.push(eq(attendances.projectId, f.project));
  if (f.q) {
    const escaped = f.q.replace(/[!%_]/g, (value) => "!" + value);
    conditions.push(
      or(
        sql`${attendances.fullNameSnapshot} LIKE ${"%" + escaped + "%"} ESCAPE '!'`,
        sql`${attendances.userCodeSnapshot} LIKE ${"%" + escaped + "%"} ESCAPE '!'`,
      ),
    );
  }
  if (f.status === "late") conditions.push(sql`${attendances.lateSeconds}>0`);
  if (f.status === "early") conditions.push(sql`${attendances.earlySeconds}>0`);
  if (f.status === "open") conditions.push(isNull(attendances.checkOutAt));
  if (f.status === "complete")
    conditions.push(sql`${attendances.checkOutAt} IS NOT NULL`);
  return and(...conditions);
}
export async function historyData(params) {
  await requirePermission("history", "read");
  const f = parseFilters(params);
  const where = condition(f);
  const size = 25;
  const roleOptions = await db
    .selectDistinct({ key: roleKey, label: roleLabel })
    .from(attendances)
    .orderBy(roleLabel);
  const projectOptions = await db
    .select({
      id: attendances.projectId,
      name: sql`MAX(${attendances.projectNameSnapshot})`,
    })
    .from(attendances)
    .where(sql`${attendances.projectId} IS NOT NULL`)
    .groupBy(attendances.projectId);
  const groups = await db
    .select({
      key: roleKey,
      label: roleLabel,
      records: count(),
      users: sql`COUNT(DISTINCT ${attendances.userId})`,
    })
    .from(attendances)
    .where(where)
    .groupBy(roleKey, roleLabel)
    .orderBy(roleLabel);
  let total, rows;
  if (f.view === "detail") {
    const [result] = await db
      .select({ total: count() })
      .from(attendances)
      .where(where);
    total = result.total;
  } else {
    const [result] = await db
      .select({
        total: sql`COUNT(DISTINCT CONCAT(${roleKey}, ':', ${attendances.userId}))`,
      })
      .from(attendances)
      .where(where);
    total = Number(result.total);
  }
  const pages = Math.max(1, Math.ceil(total / size));
  f.page = Math.min(f.page, pages);
  if (f.view === "detail")
    rows = await db
      .select({
        id: attendances.id,
        groupKey: roleKey,
        groupLabel: roleLabel,
        name: attendances.fullNameSnapshot,
        code: attendances.userCodeSnapshot,
        date: attendances.workDate,
        project: attendances.projectNameSnapshot,
        checkIn: attendances.checkInAt,
        checkOut: attendances.checkOutAt,
        timezone: attendances.timezoneSnapshot,
        lateSeconds: attendances.lateSeconds,
        earlySeconds: attendances.earlySeconds,
      })
      .from(attendances)
      .where(where)
      .orderBy(
        roleLabel,
        desc(attendances.workDate),
        desc(attendances.checkInAt),
        attendances.id,
      )
      .limit(size)
      .offset((f.page - 1) * size);
  else
    rows = await db
      .select({
        groupKey: roleKey,
        groupLabel: roleLabel,
        userId: attendances.userId,
        name: sql`MAX(${attendances.fullNameSnapshot})`,
        code: sql`MAX(${attendances.userCodeSnapshot})`,
        days: sql`COUNT(DISTINCT ${attendances.workDate})`,
        lateDays: sql`COUNT(DISTINCT CASE WHEN ${attendances.lateSeconds}>0 THEN ${attendances.workDate} END)`,
        lateSeconds: sql`SUM(${attendances.lateSeconds})`,
        open: sql`SUM(CASE WHEN ${attendances.checkOutAt} IS NULL THEN 1 ELSE 0 END)`,
        early: sql`SUM(CASE WHEN ${attendances.earlySeconds}>0 THEN 1 ELSE 0 END)`,
        duration: sql`SUM(CASE WHEN ${attendances.checkOutAt} IS NOT NULL THEN TIMESTAMPDIFF(SECOND,${attendances.checkInAt},${attendances.checkOutAt}) ELSE 0 END)`,
      })
      .from(attendances)
      .where(where)
      .groupBy(roleKey, roleLabel, attendances.userId)
      .orderBy(
        roleLabel,
        sql`MAX(${attendances.fullNameSnapshot})`,
        attendances.userId,
      )
      .limit(size)
      .offset((f.page - 1) * size);
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
  const id = parsed.data;
  const [row] = await db
    .select()
    .from(attendances)
    .where(eq(attendances.id, id))
    .limit(1);
  return row || null;
}
