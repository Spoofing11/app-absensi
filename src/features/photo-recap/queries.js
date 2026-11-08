import "server-only";
import { and, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { attendances, absences, roles, projects } from "@/lib/server/db/schema";
import { parseFilters } from "@/features/attendance-history/queries";
import { shiftDate } from "@/features/dashboard/queries";
import { countsAsPresent } from "@/lib/shared/attendance-review";
export function monday(date) {
  const day = new Date(date + "T00:00:00Z").getUTCDay();
  return shiftDate(date, -(day === 0 ? 6 : day - 1));
}
export async function photoRecapData(params = {}) {
  const filters = parseFilters({ ...params, status: "", role: "" });
  const role =
    typeof params.role === "string" && params.role.length <= 36
      ? params.role
      : "";
  const [attendanceRows, absenceRows, roleOptions, projectOptions] =
    await Promise.all([
      db
        .select()
        .from(attendances)
        .where(
          and(
            gte(attendances.workDate, filters.from),
            lte(attendances.workDate, filters.to),
            ne(attendances.roleSnapshot, "admin"),
            filters.q
              ? sql`(LOCATE(LOWER(${filters.q}), LOWER(${attendances.fullNameSnapshot})) > 0 OR LOCATE(LOWER(${filters.q}), LOWER(${attendances.userCodeSnapshot})) > 0)`
              : undefined,
            role ? eq(attendances.roleIdSnapshot, role) : undefined,
            filters.project
              ? eq(attendances.projectId, filters.project)
              : undefined,
          ),
        )
        .orderBy(desc(attendances.checkInAt), desc(attendances.id))
        .limit(5001),
      db
        .select()
        .from(absences)
        .where(
          and(
            gte(absences.workDate, filters.from),
            lte(absences.workDate, filters.to),
            ne(absences.legacyRole, "admin"),
            filters.q
              ? sql`(LOCATE(LOWER(${filters.q}), LOWER(${absences.name})) > 0 OR LOCATE(LOWER(${filters.q}), LOWER(${absences.userCode})) > 0)`
              : undefined,
            role ? eq(absences.roleId, role) : undefined,
            filters.project
              ? eq(absences.projectId, filters.project)
              : undefined,
          ),
        )
        .limit(5001),
      db
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .where(eq(roles.isSystem, false))
        .orderBy(roles.name),
      db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .orderBy(projects.name),
    ]);
  if (attendanceRows.length > 5000 || absenceRows.length > 5000)
    throw new Error(
      "Data terlalu banyak. Persempit tanggal atau pilih role/project.",
    );
  const unique = new Map();
  const matches = (name, code) =>
    !filters.q ||
    `${name} ${code}`.toLowerCase().includes(filters.q.toLowerCase());
  for (const row of attendanceRows) {
    const key = `${row.userId}:${row.workDate}`;
    if (!unique.has(key)) unique.set(key, row);
  }
  for (const row of absenceRows) {
    const key = `${row.userId}:${row.workDate}`;
    if (!unique.has(key))
      unique.set(key, {
        id: row.id,
        userId: row.userId,
        workDate: row.workDate,
        fullNameSnapshot: row.name,
        userCodeSnapshot: row.userCode,
        roleIdSnapshot: row.roleId,
        roleNameSnapshot: row.roleName,
        projectNameSnapshot: row.projectName,
        timezoneSnapshot: row.timezone,
        absenceStatus: row.status,
        workNote: row.note,
      });
  }
  const records = [...unique.values()].filter((r) =>
    matches(r.fullNameSnapshot, r.userCodeSnapshot),
  );
  for (const row of records)
    if (
      row.roleIdSnapshot &&
      !roleOptions.some((r) => r.id === row.roleIdSnapshot)
    )
      roleOptions.push({
        id: row.roleIdSnapshot,
        name: row.roleNameSnapshot || "Role sebelumnya",
      });
  const weekly = new Map();
  for (const row of records) {
    const start = monday(row.workDate);
    if (!weekly.has(start)) weekly.set(start, new Map());
    const key = row.userId;
    const week = weekly.get(start);
    if (!week.has(key))
      week.set(key, {
        userId: key,
        name: row.fullNameSnapshot,
        code: row.userCodeSnapshot,
        days: {},
        total: 0,
      });
    const person = week.get(key);
    person.days[row.workDate] = row;
    if (countsAsPresent(row)) person.total++;
  }
  const weeks = [...weekly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, people]) => ({
      start,
      dates: Array.from({ length: 7 }, (_, i) => shiftDate(start, i)),
      users: [...people.values()].sort((a, b) =>
        a.name.localeCompare(b.name, "id"),
      ),
    }));
  return {
    filters: { ...filters, role },
    roleOptions,
    projectOptions,
    weeks,
    records,
  };
}
