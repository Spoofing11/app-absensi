import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { env } from "@/lib/server/env";
import { assignmentOptions } from "@/features/assignments/project-options";
import { canUseAttendance } from "@/lib/shared/attendance-access";
import { eq } from "drizzle-orm";
import { roles, workSchedules } from "@/lib/server/db/schema";
// Both the dashboard and check-in call this resolver. Legacy per-user schedules are intentionally ignored.

export async function resolveWorkSchedule(
  connection,
  user,
  workDate = formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd"),
  assignmentId = "",
  requireSelection = true,
) {
  if (!canUseAttendance(user))
    return {
      schedule: null,
      assignment: null,
      source: "Tanpa absensi",
      blockedReason: "Absensi pribadi tidak aktif untuk akun ini.",
    };
  const options = await assignmentOptions(connection, user.id, workDate);
  let assignment = assignmentId
    ? options.find((row) => row.id === assignmentId)
    : options.length === 1
      ? options[0]
      : null;
  if (assignmentId && !assignment)
    return {
      schedule: null,
      assignment: null,
      source: "Penempatan",
      blockedReason:
        "Penempatan sudah berubah. Muat ulang lalu pilih project kembali.",
    };
  if (options.length > 1 && !assignment && requireSelection)
    return {
      schedule: null,
      assignment: null,
      source: "Pilih project saat absen masuk",
      blockedReason: "Pilih project penempatan sebelum absen masuk.",
    };
  if (user.employeeType === "tukang" && !assignment)
    return {
      schedule: null,
      assignment: null,
      source: "Belum ada penempatan hari ini",
      blockedReason:
        "Anda belum memiliki penempatan project untuk tanggal kerja ini.",
    };
  const usesProjectSchedule = user.employeeType === "tukang" && !!assignment;
  const [role] =
    !usesProjectSchedule && user.roleId
      ? await connection
          .select({ name: roles.name, workScheduleId: roles.workScheduleId })
          .from(roles)
          .where(eq(roles.id, user.roleId))
          .limit(1)
      : [];
  const projectSchedule = assignment?.workScheduleId;
  const scheduleId = usesProjectSchedule
    ? projectSchedule
    : role?.workScheduleId;
  const source = usesProjectSchedule
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
        : usesProjectSchedule
          ? "Jadwal kerja project belum ditentukan. Hubungi Admin."
          : "Jadwal kerja belum ditentukan. Hubungi Admin.",
    };
  return {
    schedule,
    assignment: assignment || null,
    source,
    blockedReason: "",
  };
}
