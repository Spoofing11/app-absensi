import "server-only";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/server/db";
import {
  absences,
  attendances,
  projectAssignments,
  projects,
  users,
} from "@/lib/server/db/schema";

export function shiftDate(date, offset) {
  const value = new Date(date + "T00:00:00Z");
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}
export function attendanceCounts(rows) {
  const result = {
    total: rows.length,
    entered: 0,
    pending: 0,
    sick: 0,
    leave: 0,
    unexcused: 0,
    late: 0,
    out: 0,
  };
  for (const row of rows) {
    if (row.checkIn) {
      result.entered++;
      if (row.late > 0) result.late++;
      if (row.checkOut) result.out++;
    } else if (row.absenceStatus) result[row.absenceStatus]++;
    else result.pending++;
  }
  return result;
}
export async function dashboardData(date, requestedProject) {
  const from = shiftDate(date, -6);
  const rows = await db
    .select({
      id: projectAssignments.id,
      date: projectAssignments.workDate,
      projectId: projects.id,
      project: projects.name,
      worker: users.name,
      userId: projectAssignments.workerId,
      checkIn: attendances.checkInAt,
      checkOut: attendances.checkOutAt,
      late: attendances.lateSeconds,
      timezone: attendances.timezoneSnapshot,
    })
    .from(projectAssignments)
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .innerJoin(users, eq(users.id, projectAssignments.workerId))
    .leftJoin(
      attendances,
      and(
        eq(attendances.projectAssignmentId, projectAssignments.id),
        eq(attendances.userId, projectAssignments.workerId),
        eq(attendances.workDate, projectAssignments.workDate),
      ),
    )
    .where(
      and(
        gte(projectAssignments.workDate, from),
        lte(projectAssignments.workDate, date),
      ),
    )
    .orderBy(
      projects.name,
      users.name,
      desc(attendances.checkInAt),
      desc(attendances.id),
    );
  const absenceRows = await db
    .select({
      assignmentId: absences.assignmentId,
      userId: absences.userId,
      date: absences.workDate,
      status: absences.status,
    })
    .from(absences)
    .where(and(gte(absences.workDate, from), lte(absences.workDate, date)));
  const absent = new Map(
    absenceRows.map((row) => [
      `${row.assignmentId}:${row.userId}:${row.date}`,
      row.status,
    ]),
  );
  const unique = new Map();
  for (const row of rows) {
    if (unique.has(row.id)) continue;
    unique.set(row.id, {
      ...row,
      absenceStatus: absent.get(`${row.id}:${row.userId}:${row.date}`) || null,
    });
  }
  const options = [
    ...new Map(rows.map((row) => [row.projectId, row.project])),
  ].map(([id, name]) => ({ id, name }));
  const selected = options.some((row) => row.id === requestedProject)
    ? requestedProject
    : "";
  const all = [...unique.values()].filter(
    (row) => !selected || row.projectId === selected,
  );
  const todayRows = all.filter((row) => row.date === date);
  const groups = new Map();
  for (const row of todayRows) {
    if (!groups.has(row.projectId))
      groups.set(row.projectId, {
        id: row.projectId,
        name: row.project,
        team: [],
      });
    groups.get(row.projectId).team.push(row);
  }
  const trend = Array.from({ length: 7 }, (_, index) => {
    const day = shiftDate(date, index - 6);
    return {
      date: day,
      ...attendanceCounts(all.filter((row) => row.date === day)),
    };
  });
  return {
    options,
    selected,
    groups: [...groups.values()],
    totals: attendanceCounts(todayRows),
    trend,
  };
}
