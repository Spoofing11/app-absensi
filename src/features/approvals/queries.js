import "server-only";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/server/db";
import { attendances, roles, projects } from "@/lib/server/db/schema";
import { env } from "@/lib/server/env";

export const REVIEW_TABS = [
  { status: "pending", label: "Menunggu Review" },
  { status: "approved", label: "Disetujui" },
  { status: "rejected", label: "Ditolak" },
];
export function approvalReadiness(row, today) {
  if (row.approvalStatus !== "pending") return null;
  if (row.checkOutAt || row.checkOut) return "ready";
  return row.workDate < today ? "missing" : "waiting";
}
export function parseApprovalFilters(params = {}) {
  const today = formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd");
  const custom =
    params.dateMode === "custom" ||
    (params.dateMode !== "default" && (!!params.from || !!params.to));
  const f = z
    .object({
      status: z.enum(["pending", "approved", "rejected", "legacy"]),
      from: z.union([z.iso.date(), z.literal("")]),
      to: z.iso.date(),
      role: z.string().max(180),
      project: z.union([z.uuid(), z.literal("")]),
      q: z.string().trim().max(100),
      page: z.coerce.number().int().min(1).max(100000),
    })
    .parse({
      status: params.status || "pending",
      from: custom ? params.from || "" : "",
      to: custom ? params.to || today : today,
      role: params.role || "",
      project: params.project || "",
      q: params.q || "",
      page: params.page || 1,
    });
  if (
    f.from &&
    (f.from > f.to || (new Date(f.to) - new Date(f.from)) / 86400000 > 366)
  )
    throw new Error("Rentang tidak valid.");
  if (f.to > today) throw new Error("Tanggal tidak boleh melewati hari ini.");
  return { ...f, dateMode: custom ? "custom" : "default", today };
}
export function approvalBounds(f, status = f.status) {
  if (f.dateMode === "custom") return { from: f.from, to: f.to };
  return { from: status === "pending" ? "" : f.today, to: f.today };
}
export function approvalHref(f, changes = {}) {
  const next = { ...f, ...changes };
  const query = new URLSearchParams({
    status: next.status,
    dateMode: next.dateMode,
    role: next.role,
    project: next.project,
    q: next.q,
    page: String(next.page),
  });
  if (next.dateMode === "custom") {
    query.set("from", next.from);
    query.set("to", next.to);
  }
  return `/approvals?${query}`;
}
function roleCondition(value) {
  if (!value) return undefined;
  if (value.startsWith("legacy:"))
    return and(
      sql`${attendances.roleIdSnapshot} IS NULL`,
      eq(attendances.roleSnapshot, value.slice(7)),
    );
  return eq(attendances.roleIdSnapshot, value);
}
function conditions(f, status) {
  const bounds = approvalBounds(f, status);
  return and(
    eq(attendances.approvalStatus, status),
    bounds.from ? gte(attendances.workDate, bounds.from) : undefined,
    lte(attendances.workDate, bounds.to),
    roleCondition(f.role),
    f.project ? eq(attendances.projectId, f.project) : undefined,
    f.q
      ? sql`(LOCATE(LOWER(${f.q}), LOWER(${attendances.fullNameSnapshot})) > 0 OR LOCATE(LOWER(${f.q}), LOWER(${attendances.userCodeSnapshot})) > 0 OR LOCATE(LOWER(${f.q}), LOWER(COALESCE(${attendances.usernameSnapshot}, ''))) > 0)`
      : undefined,
  );
}
export async function approvalData(f) {
  const statuses = ["pending", "approved", "rejected", "legacy"];
  const [counts, roleOptions, historicalRoles, projectOptions] =
    await Promise.all([
      Promise.all(
        statuses.map(async (status) => {
          const [row] = await db
            .select({ total: sql`COUNT(*)` })
            .from(attendances)
            .where(conditions(f, status));
          return [status, Number(row.total)];
        }),
      ),
      db
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .where(eq(roles.isSystem, false))
        .orderBy(roles.name),
      db
        .selectDistinct({
          id: attendances.roleIdSnapshot,
          name: attendances.roleNameSnapshot,
          legacyRole: attendances.roleSnapshot,
        })
        .from(attendances)
        .where(sql`${attendances.roleSnapshot} <> 'admin'`),
      db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .orderBy(projects.name),
    ]);
  const countByStatus = Object.fromEntries(counts);
  for (const r of historicalRoles) {
    const id = r.id || `legacy:${r.legacyRole}`;
    if (!roleOptions.some((option) => option.id === id))
      roleOptions.push({ id, name: r.name || `Data lama · ${r.legacyRole}` });
  }
  const pages = Math.max(1, Math.ceil(countByStatus[f.status] / 25));
  const page = Math.min(f.page, pages);
  const order =
    f.status === "pending"
      ? [
          sql`CASE WHEN ${attendances.checkOutAt} IS NOT NULL OR ${attendances.workDate} < ${f.today} THEN 0 ELSE 1 END`,
          asc(attendances.workDate),
          asc(attendances.checkInAt),
          attendances.id,
        ]
      : [
          desc(attendances.workDate),
          desc(attendances.reviewedAt),
          attendances.id,
        ];
  const rows = await db
    .select()
    .from(attendances)
    .where(conditions(f, f.status))
    .orderBy(...order)
    .limit(25)
    .offset((page - 1) * 25);
  return {
    rows,
    counts: countByStatus,
    roleOptions,
    projectOptions,
    pages,
    page,
    total: countByStatus[f.status],
  };
}
