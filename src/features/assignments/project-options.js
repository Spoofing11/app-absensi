import "server-only";
import { and, eq, or, lt, gte, isNull } from "drizzle-orm";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { env } from "@/lib/server/env";
import { projectAssignments, projects } from "@/lib/server/db/schema";

export function placementDateCondition(date) {
  const today = formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd");
  const next = new Date(date + "T00:00:00Z");
  next.setUTCDate(next.getUTCDate() + 1);
  const dayStart = fromZonedTime(`${date}T00:00:00`, env.APP_TIMEZONE);
  const dayEnd = fromZonedTime(
    `${next.toISOString().slice(0, 10)}T00:00:00`,
    env.APP_TIMEZONE,
  );
  return or(
    and(
      eq(projectAssignments.assignmentType, "daily"),
      eq(projectAssignments.workDate, date),
    ),
    and(
      eq(projectAssignments.assignmentType, "ongoing"),
      lt(projectAssignments.createdAt, dayEnd),
      date === today
        ? eq(projectAssignments.isActive, true)
        : or(
            isNull(projectAssignments.endedAt),
            gte(projectAssignments.endedAt, dayStart),
          ),
    ),
  );
}
export async function assignmentOptions(connection, userId, date) {
  const rows = await connection
    .select({
      id: projectAssignments.id,
      projectId: projects.id,
      projectCode: projects.projectCode,
      projectName: projects.name,
      projectAddress: projects.address,
      workScheduleId: projects.workScheduleId,
      assignmentType: projectAssignments.assignmentType,
    })
    .from(projectAssignments)
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .where(
      and(
        eq(projectAssignments.workerId, userId),
        eq(projects.status, "active"),
        placementDateCondition(date),
      ),
    )
    .orderBy(projects.name, projectAssignments.id);
  const byProject = new Map();
  for (const row of rows)
    if (!byProject.has(row.projectId) || row.assignmentType === "daily")
      byProject.set(row.projectId, row);
  return [...byProject.values()];
}
