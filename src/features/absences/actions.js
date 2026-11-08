"use server";
import {
  assignmentOptions,
  placementDateCondition,
} from "@/features/assignments/project-options";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/server/db";
import {
  absences,
  attendances,
  users,
  roles,
  projects,
  projectAssignments,
} from "@/lib/server/db/schema";
import { requirePermission } from "@/lib/server/auth/permissions";
import { canUseAttendance } from "@/lib/shared/attendance-access";
import { validWorkDate } from "@/lib/shared/assignment-date";
import { resolveWorkSchedule } from "@/features/schedules/resolver";
import { attendanceTiming } from "@/features/schedules/timing";
import { recordActivity } from "@/features/activity-logs/server";
import { env } from "@/lib/server/env";
import { ABSENCE_LABELS } from "./labels";

function refresh() {
  for (const route of [
    "/absences",
    "/history",
    "/admin/dashboard",
    "/dashboard",
    "/assignments",
  ])
    revalidatePath(route);
}

export async function absenceOptions(date) {
  await requirePermission("absences", "read");
  if (!validWorkDate(date)) return { error: "Pilih tanggal yang valid." };
  const workers = await db
    .select({
      id: users.id,
      name: users.name,
      employeeType: users.employeeType,
    })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        eq(users.attendanceEnabled, true),
        inArray(users.employeeType, ["karyawan", "tukang"]),
      ),
    );
  const assignments = await db
    .select({
      userId: projectAssignments.workerId,
      projectId: projectAssignments.projectId,
      projectName: projects.name,
    })
    .from(projectAssignments)
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .where(placementDateCondition(date));
  const present = await db
    .select({ userId: attendances.userId })
    .from(attendances)
    .where(eq(attendances.workDate, date));
  const absent = await db
    .select({ id: absences.id, userId: absences.userId })
    .from(absences)
    .where(eq(absences.workDate, date));
  return {
    workers,
    assignments,
    present: present.map((row) => row.userId),
    absent,
  };
}

export async function saveAbsence(form) {
  const editing = !!form.get("id");
  const actor = await requirePermission(
    "absences",
    editing ? "edit" : "create",
  );
  const parsed = z
    .object({
      id: z.uuid().optional(),
      userId: z.uuid(),
      workDate: z.string().refine(validWorkDate),
      employeeType: z.enum(["karyawan", "tukang"]),
      projectId: z.union([z.uuid(), z.literal("")]),
      status: z.enum(["sick", "leave", "unexcused"]),
      note: z.string().trim().max(2000),
    })
    .safeParse({
      ...Object.fromEntries(form),
      id: form.get("id") || undefined,
    });
  if (!parsed.success)
    return {
      error:
        "Periksa tanggal, pengguna, status, dan catatan maksimal 2000 karakter.",
    };
  const data = parsed.data;
  let expectedError = "";
  try {
    await db.transaction(async (tx) => {
      function fail(message) {
        expectedError = message;
        throw new Error(message);
      }
      const [discovered] = editing
        ? await tx.select().from(absences).where(eq(absences.id, data.id))
        : [];
      if (editing && !discovered)
        fail("Catatan tidak ditemukan. Muat ulang halaman.");
      const ids = [
        ...new Set([data.userId, discovered?.userId].filter(Boolean)),
      ].sort();
      const locked = await tx
        .select()
        .from(users)
        .where(inArray(users.id, ids))
        .orderBy(users.id)
        .for("update");
      const user = locked.find((row) => row.id === data.userId);
      if (!canUseAttendance(user) || user.employeeType !== data.employeeType)
        fail(
          "Pilih pengguna aktif dengan jenis pekerja dan absensi yang sesuai.",
        );
      const [previous] = editing
        ? await tx
            .select()
            .from(absences)
            .where(eq(absences.id, data.id))
            .for("update")
        : [];
      if (editing && (!previous || previous.userId !== discovered.userId))
        fail("Catatan berubah. Muat ulang halaman.");
      const [present] = await tx
        .select({ id: attendances.id })
        .from(attendances)
        .where(
          and(
            eq(attendances.userId, data.userId),
            eq(attendances.workDate, data.workDate),
          ),
        )
        .limit(1)
        .for("update");
      if (present) fail("Pengguna sudah hadir pada tanggal tersebut.");
      const [duplicate] = await tx
        .select({ id: absences.id })
        .from(absences)
        .where(
          and(
            eq(absences.userId, data.userId),
            eq(absences.workDate, data.workDate),
          ),
        )
        .limit(1)
        .for("update");
      if (duplicate && duplicate.id !== previous?.id)
        fail(
          "Pengguna sudah memiliki catatan ketidakhadiran pada tanggal tersebut.",
        );
      const placements = await assignmentOptions(tx, user.id, data.workDate);
      const placement = placements.find((p) => p.projectId === data.projectId);
      const resolved = await resolveWorkSchedule(
        tx,
        user,
        data.workDate,
        placement?.id || "",
        false,
      );
      let assignment = resolved.assignment;
      if (user.employeeType === "tukang" && !assignment) {
        [assignment] = await tx
          .select({
            id: projectAssignments.id,
            projectId: projects.id,
            projectName: projects.name,
            projectCode: projects.projectCode,
          })
          .from(projectAssignments)
          .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
          .where(
            and(
              eq(projectAssignments.workerId, user.id),
              eq(projectAssignments.workDate, data.workDate),
            ),
          )
          .for("share");
      }
      if (
        user.employeeType === "tukang" &&
        (!assignment || assignment.projectId !== data.projectId)
      )
        fail(
          "Tukang tidak ditempatkan di project tersebut pada tanggal pilihan.",
        );
      const [role] = user.roleId
        ? await tx.select().from(roles).where(eq(roles.id, user.roleId))
        : [];
      const timing = resolved.schedule
        ? attendanceTiming(data.workDate, resolved.schedule, env.APP_TIMEZONE)
        : null;
      const values = {
        userId: user.id,
        workDate: data.workDate,
        status: data.status,
        note: data.note || null,
        employeeType: user.employeeType,
        assignmentId: assignment?.id || null,
        projectId: assignment?.projectId || null,
        projectName: assignment?.projectName || null,
        projectCode: assignment?.projectCode || null,
        name: user.name,
        username: user.username,
        userCode: user.userCode,
        roleId: user.roleId,
        roleName: role?.name || null,
        legacyRole: user.role,
        timezone: env.APP_TIMEZONE,
        scheduleName: resolved.schedule?.name || null,
        scheduledStartAt: timing?.scheduledStartAt || null,
        scheduledEndAt: timing?.scheduledEndAt || null,
      };
      if (previous)
        await tx
          .update(absences)
          .set(values)
          .where(eq(absences.id, previous.id));
      else
        await tx
          .insert(absences)
          .values({ ...values, id: randomUUID(), createdById: actor.id });
      await recordActivity(
        tx,
        actor,
        "absences",
        editing ? "edit" : "create",
        `${user.name} · ${data.workDate} · ${ABSENCE_LABELS[data.status]}${assignment ? ` · ${assignment.projectName}` : ""}`,
      );
    });
  } catch {
    return {
      error:
        expectedError ||
        "Catatan belum tersimpan. Muat ulang dan periksa apakah data sudah berubah.",
    };
  }
  refresh();
  return { success: true };
}

export async function deleteAbsence(rawId) {
  const actor = await requirePermission("absences", "delete");
  const id = z.uuid().parse(rawId);
  await db.transaction(async (tx) => {
    const [discovered] = await tx
      .select()
      .from(absences)
      .where(eq(absences.id, id));
    if (!discovered) return;
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, discovered.userId))
      .for("update");
    const [row] = await tx
      .select()
      .from(absences)
      .where(eq(absences.id, id))
      .for("update");
    if (!row) return;
    if (row.userId !== discovered.userId)
      throw new Error("Data berubah. Muat ulang halaman.");
    await tx.delete(absences).where(eq(absences.id, id));
    await recordActivity(
      tx,
      actor,
      "absences",
      "delete",
      `${row.name} · ${row.workDate} · ${ABSENCE_LABELS[row.status]}`,
    );
  });
  refresh();
  return { success: true };
}
