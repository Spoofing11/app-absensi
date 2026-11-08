import "server-only";
import { and, desc, eq, gte, lte, ne, or } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/server/db";
import {
  absences,
  attendances,
  projectAssignments,
  projects,
  users,
  roles,
} from "@/lib/server/db/schema";
import { env } from "@/lib/server/env";
export function shiftDate(date, offset) {
  const value = new Date(date + "T00:00:00Z");
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}
export function attendanceCounts(rows) {
  const result = {
    total: 0,
    entered: 0,
    pending: 0,
    sick: 0,
    leave: 0,
    unexcused: 0,
    late: 0,
    out: 0,
  };
  const unique = new Map(rows.map((r) => [`${r.userId}:${r.date}`, r]));
  result.total = unique.size;
  for (const row of unique.values()) {
    if (row.approvalStatus === "rejected") continue;
    if (row.checkIn) {
      result.entered++;
      if (row.late > 0) result.late++;
      if (row.checkOut) result.out++;
    } else if (row.absenceStatus) result[row.absenceStatus]++;
    else result.pending++;
  }
  return result;
}
export async function dashboardData(date, requestedProject, requestedRole) {
  const from = shiftDate(date, -6);
  const [
    people,
    placements,
    attendanceRows,
    absenceRows,
    roleRows,
    projectRows,
  ] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        roleId: users.roleId,
        employeeType: users.employeeType,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        and(
          ne(users.role, "admin"),
          eq(users.isActive, true),
          eq(users.attendanceEnabled, true),
        ),
      ),
    db
      .select({
        id: projectAssignments.id,
        userId: projectAssignments.workerId,
        projectId: projects.id,
        project: projects.name,
        workDate: projectAssignments.workDate,
        type: projectAssignments.assignmentType,
        createdAt: projectAssignments.createdAt,
        endedAt: projectAssignments.endedAt,
      })
      .from(projectAssignments)
      .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
      .where(
        or(
          and(
            gte(projectAssignments.workDate, from),
            lte(projectAssignments.workDate, date),
          ),
          eq(projectAssignments.assignmentType, "ongoing"),
        ),
      ),
    db
      .select()
      .from(attendances)
      .where(
        and(
          gte(attendances.workDate, from),
          lte(attendances.workDate, date),
          ne(attendances.roleSnapshot, "admin"),
        ),
      )
      .orderBy(desc(attendances.checkInAt), desc(attendances.id)),
    db
      .select()
      .from(absences)
      .where(
        and(
          gte(absences.workDate, from),
          lte(absences.workDate, date),
          ne(absences.legacyRole, "admin"),
        ),
      ),
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
  const options = projectRows;
  const selected = options.some((p) => p.id === requestedProject)
    ? requestedProject
    : "";
  const roleOptions = [...roleRows];
  for (const a of attendanceRows)
    if (a.roleIdSnapshot && !roleOptions.some((r) => r.id === a.roleIdSnapshot))
      roleOptions.push({
        id: a.roleIdSnapshot,
        name: a.roleNameSnapshot || "Role sebelumnya",
      });
  for (const n of absenceRows)
    if (n.roleId && !roleOptions.some((r) => r.id === n.roleId))
      roleOptions.push({ id: n.roleId, name: n.roleName || "Role sebelumnya" });
  for (const a of attendanceRows)
    if (
      !a.roleIdSnapshot &&
      !roleOptions.some((r) => r.id === `legacy:${a.roleSnapshot}`)
    )
      roleOptions.push({
        id: `legacy:${a.roleSnapshot}`,
        name: `Data lama · ${a.roleSnapshot}`,
      });
  for (const n of absenceRows)
    if (
      !n.roleId &&
      !roleOptions.some((r) => r.id === `legacy:${n.legacyRole}`)
    )
      roleOptions.push({
        id: `legacy:${n.legacyRole}`,
        name: `Data lama · ${n.legacyRole}`,
      });
  const selectedRole = roleOptions.some((r) => r.id === requestedRole)
    ? requestedRole
    : "";
  const zoneDate = (value) =>
    formatInTimeZone(value, env.APP_TIMEZONE, "yyyy-MM-dd");
  const all = [];
  for (let offset = 0; offset < 7; offset++) {
    const day = shiftDate(from, offset);
    const active = placements.filter((p) =>
      p.type === "daily"
        ? p.workDate === day
        : zoneDate(p.createdAt) <= day &&
          (!p.endedAt || zoneDate(p.endedAt) >= day),
    );
    const actual = new Map();
    for (const row of attendanceRows)
      if (row.workDate === day && !actual.has(row.userId))
        actual.set(row.userId, row);
    const absent = new Map(
      absenceRows.filter((a) => a.workDate === day).map((a) => [a.userId, a]),
    );
    const ids = new Set([
      ...people
        .filter(
          (u) =>
            zoneDate(u.createdAt) <= day &&
            (u.employeeType !== "tukang" ||
              active.some((p) => p.userId === u.id)),
        )
        .map((u) => u.id),
      ...actual.keys(),
      ...absent.keys(),
    ]);
    for (const id of ids) {
      const person = people.find((u) => u.id === id);
      const a = actual.get(id);
      const n = absent.get(id);
      const roleId = a
        ? a.roleIdSnapshot || `legacy:${a.roleSnapshot}`
        : n
          ? n.roleId || `legacy:${n.legacyRole}`
          : person?.roleId;
      if (selectedRole && roleId !== selectedRole) continue;
      // Actual attendance uses its historical project, never a newer placement.
      const memberships = a
        ? [
            {
              projectId: a.projectId || "",
              project:
                a.projectNameSnapshot ||
                (a.workType === "operational"
                  ? "Operasional / Tanpa Project"
                  : "Tanpa Project"),
            },
          ]
        : n
          ? [
              {
                projectId: n.projectId || "",
                project: n.projectName || "Tanpa Project",
              },
            ]
          : active.filter((p) => p.userId === id);
      const slots = memberships.length
        ? memberships
        : [{ projectId: "", project: "Tanpa Project" }];
      for (const slot of slots) {
        if (selected && slot.projectId !== selected) continue;
        all.push({
          id: `${day}:${id}:${slot.projectId}`,
          userId: id,
          date: day,
          projectId: slot.projectId,
          project: slot.project,
          worker: a?.fullNameSnapshot || n?.name || person?.name || "Pengguna",
          checkIn: a?.checkInAt || null,
          checkOut: a?.checkOutAt || null,
          approvalStatus: a?.approvalStatus,
          late: a?.lateSeconds || 0,
          timezone: a?.timezoneSnapshot || env.APP_TIMEZONE,
          absenceStatus: n?.status || null,
        });
      }
    }
  }
  const todayRows = all.filter((r) => r.date === date);
  const groups = new Map();
  for (const row of todayRows) {
    if (!groups.has(row.projectId))
      groups.set(row.projectId, {
        id: row.projectId || "none",
        name: row.project,
        team: [],
      });
    groups.get(row.projectId).team.push(row);
  }
  const trend = Array.from({ length: 7 }, (_, i) => {
    const day = shiftDate(from, i);
    return {
      date: day,
      ...attendanceCounts(all.filter((r) => r.date === day)),
    };
  });
  return {
    options,
    selected,
    roleOptions,
    selectedRole,
    groups: [...groups.values()],
    totals: attendanceCounts(todayRows),
    trend,
  };
}
