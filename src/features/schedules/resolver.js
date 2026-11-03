import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { env } from "@/lib/server/env";
import { canUseAttendance } from "@/lib/shared/attendance-access";
import { and, eq } from "drizzle-orm";
import {
  roles,
  workSchedules,
  projects,
  projectAssignments,
} from "@/lib/server/db/schema";
// Both the dashboard and check-in call this resolver. Legacy per-user schedules are intentionally ignored.

export async function resolveWorkSchedule(
  connection,
  user,
  workDate = formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd"),
) {
  if (!canUseAttendance(user))
    return {
      schedule: null,
      assignment: null,
      source: "Tanpa absensi",
      blockedReason: "Absensi pribadi tidak aktif untuk akun ini.",
    };
  let assignment = null;
  if (user.employeeType === "tukang") {
    [assignment] = await connection
      .select({
        id: projectAssignments.id,
        projectId: projects.id,
        projectCode: projects.projectCode,
        projectName: projects.name,
        projectAddress: projects.address,
        workScheduleId: projects.workScheduleId,
      })
      .from(projectAssignments)
      .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
      .where(
        and(
          eq(projectAssignments.workerId, user.id),
          eq(projectAssignments.workDate, workDate),
          eq(projects.status, "active"),
        ),
      )
      .limit(1);
    if (!assignment)
      return {
        schedule: null,
        assignment: null,
        source: "Belum ada penempatan hari ini",
        blockedReason:
          "Anda belum memiliki penempatan project untuk tanggal kerja ini.",
      };
  }
  const [role] = user.roleId
    ? await connection
        .select({ name: roles.name, workScheduleId: roles.workScheduleId })
        .from(roles)
        .where(eq(roles.id, user.roleId))
        .limit(1)
    : [];
  const projectSchedule = assignment?.workScheduleId;
  const scheduleId = projectSchedule || role?.workScheduleId;
  const source = projectSchedule
    ? `Project ${assignment.projectName}`
    : role
      ? `Role ${role.name}`
      : "Belum diatur";
  const [schedule] = scheduleId
    ? await connection
        .select()
        .from(workSchedules)
        .where(eq(workSchedules.id, scheduleId))
        .limit(1)
    : [];
  // An explicitly selected but inactive schedule must be fixed, not silently replaced by another schedule.
  if (!schedule?.isActive)
    return {
      schedule: null,
      assignment: assignment || null,
      source,
      blockedReason: schedule
        ? "Jadwal kerja nonaktif. Hubungi Admin."
        : "Jadwal kerja belum ditentukan. Hubungi Admin.",
    };
  return {
    schedule,
    assignment: assignment || null,
    source,
    blockedReason: "",
  };
}
