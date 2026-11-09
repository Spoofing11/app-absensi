"use server";
import { recordActivity } from "@/features/activity-logs/server";
import { formatInTimeZone } from "date-fns-tz";
import { env } from "@/lib/server/env";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/server/db";
import {
  users,
  projects,
  projectAssignments,
  notifications,
  attendances,
  absences,
} from "@/lib/server/db/schema";
import { requirePermission } from "@/lib/server/auth/permissions";
import { validWorkDate } from "@/lib/shared/assignment-date";

function refresh() {
  for (const route of [
    "/assignments",
    "/users",
    "/dashboard",
    "/admin/dashboard",
    "/history",
    "/approvals",
    "/photo-recap",
  ])
    revalidatePath(route);
}

// A correction applies only to this user's unfinished, undecided attendance today.
// Earlier days, photos, times, schedules and decisions remain historical snapshots.
async function correctOpenAttendance(tx, assignment, project = null) {
  const today = formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd");
  const records = await tx
    .select({ id: attendances.id, oldProject: attendances.projectNameSnapshot })
    .from(attendances)
    .where(
      and(
        eq(attendances.projectAssignmentId, assignment.id),
        eq(attendances.userId, assignment.workerId),
        eq(attendances.workDate, today),
        isNull(attendances.checkOutAt),
        notInArray(attendances.approvalStatus, ["approved", "rejected"]),
      ),
    )
    .for("update");
  if (records.length)
    await tx
      .update(attendances)
      .set({
        projectAssignmentId: project ? assignment.id : null,
        projectId: project?.id || null,
        projectCodeSnapshot: project?.projectCode || null,
        projectNameSnapshot: project?.name || null,
        workType: project ? "project" : "operational",
        workNote: null,
        reportedProjectId: null,
        reportedProjectName: null,
      })
      .where(
        inArray(
          attendances.id,
          records.map((r) => r.id),
        ),
      );
  return records;
}

async function ensureUnused(tx, id) {
  const [used] = await tx
    .select({ id: attendances.id })
    .from(attendances)
    .where(eq(attendances.projectAssignmentId, id))
    .limit(1)
    .for("update");
  const [absence] = await tx
    .select({ id: absences.id })
    .from(absences)
    .where(eq(absences.assignmentId, id))
    .limit(1)
    .for("update");
  if (used || absence)
    throw new Error(
      "Penempatan sudah digunakan untuk absensi atau ketidakhadiran. Hapus catatan ketidakhadiran terlebih dahulu jika ingin mengubah penempatan.",
    );
}

export async function saveAssignment(form) {
  const editing = !!form.get("id");
  const actor = await requirePermission(
    "assignments",
    editing ? "edit" : "create",
  );
  const parsed = z
    .object({
      id: z.uuid().optional(),
      projectId: z.uuid(),
      workDate: z.string().refine(validWorkDate),
      workerIds: z.array(z.uuid()).min(1).max(100),
    })
    .safeParse({
      id: form.get("id") || undefined,
      projectId: form.get("projectId"),
      workDate: form.get("workDate"),
      workerIds: form.getAll("workerId"),
    });
  if (!parsed.success)
    return {
      error: "Pilih tanggal kerja yang valid, project, dan 1–100 tukang.",
    };
  const data = parsed.data;
  if (
    new Set(data.workerIds).size !== data.workerIds.length ||
    (editing && data.workerIds.length !== 1)
  )
    return {
      error:
        "Tukang tidak boleh dipilih dua kali. Edit satu penempatan dalam satu waktu.",
    };
  let expectedError = "";
  try {
    await db.transaction(async (tx) => {
      function fail(message) {
        expectedError = message;
        throw new Error(message);
      }
      const [discovered] = editing
        ? await tx
            .select()
            .from(projectAssignments)
            .where(eq(projectAssignments.id, data.id))
        : [];
      if (editing && !discovered)
        fail("Penempatan tidak ditemukan. Muat ulang halaman.");
      // All attendance and placement mutations lock the worker first, preventing races.
      const ids = [
        ...new Set([...data.workerIds, discovered?.workerId].filter(Boolean)),
      ].sort();
      const locked = await tx
        .select()
        .from(users)
        .where(inArray(users.id, ids))
        .orderBy(users.id)
        .for("update");
      const [previous] = editing
        ? await tx
            .select()
            .from(projectAssignments)
            .where(eq(projectAssignments.id, data.id))
            .for("update")
        : [];
      if (editing && (!previous || previous.workerId !== discovered.workerId))
        fail("Penempatan sudah berubah. Muat ulang halaman.");
      if (previous) {
        if (!previous.workDate)
          fail("Arsip penempatan lama tidak dapat diubah.");
        try {
          await ensureUnused(tx, previous.id);
        } catch (error) {
          fail(error.message);
        }
      }
      const [project] = await tx
        .select()
        .from(projects)
        .where(
          and(eq(projects.id, data.projectId), eq(projects.status, "active")),
        )
        .for("share");
      if (!project) fail("Project tidak aktif atau tidak ditemukan.");
      for (const workerId of data.workerIds) {
        const worker = locked.find((row) => row.id === workerId);
        if (!worker?.isActive || worker.employeeType !== "tukang")
          fail("Tukang tidak aktif atau jenis pekerjanya telah berubah.");
        const [conflict] = await tx
          .select({ id: projectAssignments.id })
          .from(projectAssignments)
          .where(
            and(
              eq(projectAssignments.workerId, workerId),
              eq(projectAssignments.workDate, data.workDate),
            ),
          )
          .limit(1);
        if (conflict && conflict.id !== previous?.id)
          fail(
            `${worker.name} sudah memiliki penempatan pada tanggal tersebut. Pilih tanggal atau tukang lain.`,
          );
        const id = previous?.id || randomUUID();
        if (previous) {
          await tx
            .update(projectAssignments)
            .set({
              workerId,
              projectId: data.projectId,
              workDate: data.workDate,
              updatedById: actor.id,
            })
            .where(eq(projectAssignments.id, id));
          await tx
            .delete(notifications)
            .where(eq(notifications.assignmentId, id));
        } else {
          await tx.insert(projectAssignments).values({
            id,
            assignmentCode: `ASG-${id.slice(0, 8)}`,
            workerId,
            projectId: data.projectId,
            workDate: data.workDate,
            createdById: actor.id,
          });
        }
        await tx.insert(notifications).values({
          id: randomUUID(),
          recipientId: workerId,
          assignmentId: id,
          initialKey: id,
          projectName: project.name,
          projectAddress: project.address,
        });
        await recordActivity(
          tx,
          actor,
          "assignments",
          editing ? "edit" : "create",
          `${worker.name} → ${project.name} · ${data.workDate}`,
        );
      }
    });
  } catch {
    return {
      error:
        expectedError ||
        "Penempatan belum dapat disimpan. Data mungkin berubah atau tanggal sudah terisi. Muat ulang dan coba lagi.",
    };
  }
  refresh();
  return { success: true };
}

export async function deleteAssignment(form) {
  const actor = await requirePermission("assignments", "delete");
  const parsed = z.uuid().safeParse(form.get("id"));
  if (!parsed.success) return { error: "Penempatan tidak valid." };
  let expectedError = "";
  try {
    await db.transaction(async (tx) => {
      const [discovered] = await tx
        .select()
        .from(projectAssignments)
        .where(eq(projectAssignments.id, parsed.data));
      if (!discovered) return;
      const [worker] = await tx
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, discovered.workerId))
        .for("update");
      const [row] = await tx
        .select()
        .from(projectAssignments)
        .where(eq(projectAssignments.id, parsed.data))
        .for("update");
      if (!row) return;
      if (
        row.workerId !== discovered.workerId ||
        (row.assignmentType !== "ongoing" && !row.workDate)
      ) {
        expectedError =
          "Data sudah berubah atau merupakan arsip lama. Muat ulang halaman.";
        throw new Error(expectedError);
      }
      let corrections = [];
      if (row.assignmentType === "ongoing") {
        corrections = await correctOpenAttendance(tx, row);
        // Detach nullable links, retaining every attendance/absence and its snapshots.
        await tx
          .update(attendances)
          .set({ projectAssignmentId: null })
          .where(eq(attendances.projectAssignmentId, row.id));
        await tx
          .update(absences)
          .set({ assignmentId: null })
          .where(eq(absences.assignmentId, row.id));
      } else {
        try {
          await ensureUnused(tx, row.id);
        } catch (error) {
          expectedError = error.message;
          throw error;
        }
      }
      await tx
        .delete(notifications)
        .where(eq(notifications.assignmentId, row.id));
      await tx
        .delete(projectAssignments)
        .where(eq(projectAssignments.id, row.id));
      const [project] = await tx
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, row.projectId));
      await recordActivity(
        tx,
        actor,
        "assignments",
        "delete",
        `${worker?.name || "Pengguna"} · ${project?.name || "Project"} · ${row.workDate || "Penempatan karyawan"} · ${corrections.length} absensi terbuka menjadi Operasional${corrections.length ? ` · ID: ${corrections.map((r) => r.id).join(", ")}` : ""}`,
      );
    });
  } catch {
    return {
      error:
        expectedError ||
        "Penempatan belum dapat dihapus. Muat ulang dan coba lagi.",
    };
  }
  refresh();
  return { success: true };
}

// Ongoing placements are retired rather than reactivated, preserving their history.
export async function saveOngoingAssignment(form) {
  const actor = await requirePermission("assignments", "create");
  const parsed = z
    .object({ projectId: z.uuid(), userIds: z.array(z.uuid()).min(1).max(100) })
    .safeParse({
      projectId: form.get("projectId"),
      userIds: [...new Set(form.getAll("userId"))],
    });
  if (!parsed.success) return { error: "Pilih project dan 1–100 pengguna." };
  try {
    await db.transaction(async (tx) => {
      const selected = await tx
        .select()
        .from(users)
        .where(inArray(users.id, parsed.data.userIds))
        .orderBy(users.id)
        .for("update");
      if (
        selected.length !== parsed.data.userIds.length ||
        selected.some(
          (u) =>
            !u.isActive || u.role === "admin" || u.employeeType !== "karyawan",
        )
      )
        throw new Error("Pengguna tidak tersedia.");
      const [project] = await tx
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, parsed.data.projectId),
            eq(projects.status, "active"),
          ),
        )
        .for("share");
      if (!project) throw new Error("Project tidak aktif.");
      for (const person of selected) {
        const [duplicate] = await tx
          .select({ id: projectAssignments.id })
          .from(projectAssignments)
          .where(
            and(
              eq(projectAssignments.workerId, person.id),
              eq(projectAssignments.projectId, project.id),
              eq(projectAssignments.assignmentType, "ongoing"),
              eq(projectAssignments.isActive, true),
            ),
          )
          .for("update");
        if (duplicate)
          throw new Error(
            "Pengguna sudah memiliki penempatan aktif pada project ini.",
          );
        const id = randomUUID();
        await tx.insert(projectAssignments).values({
          id,
          assignmentCode: `ASG-${id.slice(0, 8)}`,
          workerId: person.id,
          projectId: project.id,
          assignmentType: "ongoing",
          isActive: true,
          createdById: actor.id,
        });
        await tx.insert(notifications).values({
          id: randomUUID(),
          recipientId: person.id,
          assignmentId: id,
          initialKey: id,
          projectName: project.name,
          projectAddress: project.address,
        });
        await recordActivity(
          tx,
          actor,
          "assignments",
          "create",
          `${person.name} → ${project.name} · Tanpa batas tanggal`,
        );
      }
    });
    refresh();
    revalidatePath("/admin/dashboard");
    return { success: "Penempatan berhasil disimpan." };
  } catch (error) {
    const known = [
      "Pengguna tidak tersedia.",
      "Project tidak aktif.",
      "Pengguna sudah memiliki penempatan aktif pada project ini.",
    ];
    return {
      error: known.includes(error.message)
        ? error.message
        : "Penempatan belum dapat disimpan.",
    };
  }
}
export async function deactivateAssignment(form) {
  const actor = await requirePermission("assignments", "edit");
  const id = z.uuid().parse(form.get("id"));
  await db.transaction(async (tx) => {
    const [found] = await tx
      .select()
      .from(projectAssignments)
      .where(eq(projectAssignments.id, id));
    if (!found) throw new Error("Penempatan tidak ditemukan.");
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, found.workerId))
      .for("update");
    const [row] = await tx
      .select()
      .from(projectAssignments)
      .where(eq(projectAssignments.id, id))
      .for("update");
    if (
      !row ||
      row.workerId !== found.workerId ||
      row.assignmentType !== "ongoing" ||
      !row.isActive
    )
      throw new Error("Penempatan sudah berubah.");
    await tx
      .update(projectAssignments)
      .set({ isActive: false, endedAt: new Date(), updatedById: actor.id })
      .where(eq(projectAssignments.id, id));
    await recordActivity(
      tx,
      actor,
      "assignments",
      "edit",
      `Penempatan ${row.assignmentCode} dinonaktifkan.`,
    );
  });
  refresh();
  revalidatePath("/admin/dashboard");
}

export async function reactivateAssignment(form) {
  const actor = await requirePermission("assignments", "edit");
  const id = z.uuid().parse(form.get("id"));
  await db.transaction(async (tx) => {
    const [found] = await tx
      .select()
      .from(projectAssignments)
      .where(eq(projectAssignments.id, id));
    if (!found) throw new Error("Penempatan tidak ditemukan.");
    const [person] = await tx
      .select()
      .from(users)
      .where(eq(users.id, found.workerId))
      .for("update");
    const [row] = await tx
      .select()
      .from(projectAssignments)
      .where(eq(projectAssignments.id, id))
      .for("update");
    if (
      !row ||
      row.workerId !== found.workerId ||
      row.assignmentType !== "ongoing" ||
      row.isActive ||
      !person?.isActive ||
      person.role === "admin"
    )
      throw new Error("Penempatan tidak dapat diaktifkan.");
    const [project] = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.id, row.projectId), eq(projects.status, "active")))
      .for("share");
    if (!project) throw new Error("Project tidak aktif.");
    const [duplicate] = await tx
      .select({ id: projectAssignments.id })
      .from(projectAssignments)
      .where(
        and(
          eq(projectAssignments.workerId, row.workerId),
          eq(projectAssignments.projectId, row.projectId),
          eq(projectAssignments.assignmentType, "ongoing"),
          eq(projectAssignments.isActive, true),
        ),
      )
      .for("update");
    if (duplicate)
      throw new Error("Sudah ada penempatan aktif pada project ini.");
    const nextId = randomUUID();
    await tx.insert(projectAssignments).values({
      id: nextId,
      assignmentCode: `ASG-${nextId.slice(0, 8)}`,
      workerId: row.workerId,
      projectId: row.projectId,
      assignmentType: "ongoing",
      isActive: true,
      createdById: actor.id,
    });
    await tx.insert(notifications).values({
      id: randomUUID(),
      recipientId: row.workerId,
      assignmentId: nextId,
      initialKey: nextId,
      projectName: project.name,
      projectAddress: project.address,
    });
    await recordActivity(
      tx,
      actor,
      "assignments",
      "edit",
      `${person.name} → ${project.name} · Penempatan diaktifkan kembali`,
    );
  });
  refresh();
  revalidatePath("/admin/dashboard");
}

export async function updateOngoingAssignment(form) {
  const actor = await requirePermission("assignments", "edit");
  const parsed = z
    .object({ id: z.uuid(), userId: z.uuid(), projectId: z.uuid() })
    .safeParse({
      id: form.get("id"),
      userId: form.get("userId"),
      projectId: form.get("projectId"),
    });
  if (!parsed.success)
    return { error: "Pilih pengguna dan project yang valid." };
  let expectedError = "";
  try {
    await db.transaction(async (tx) => {
      function fail(message) {
        expectedError = message;
        throw new Error(message);
      }
      const [found] = await tx
        .select()
        .from(projectAssignments)
        .where(eq(projectAssignments.id, parsed.data.id));
      if (!found || found.assignmentType !== "ongoing")
        fail("Penempatan tidak ditemukan.");
      const ids = [...new Set([found.workerId, parsed.data.userId])].sort();
      const people = await tx
        .select()
        .from(users)
        .where(inArray(users.id, ids))
        .orderBy(users.id)
        .for("update");
      const [row] = await tx
        .select()
        .from(projectAssignments)
        .where(eq(projectAssignments.id, found.id))
        .for("update");
      if (
        !row ||
        row.workerId !== found.workerId ||
        row.assignmentType !== "ongoing"
      )
        fail("Penempatan sudah berubah. Muat ulang halaman.");
      const person = people.find((u) => u.id === parsed.data.userId);
      if (
        !person?.isActive ||
        person.role === "admin" ||
        person.employeeType !== "karyawan"
      )
        fail("Pilih karyawan aktif dari role yang sesuai.");
      const [project] = await tx
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, parsed.data.projectId),
            eq(projects.status, "active"),
          ),
        )
        .for("share");
      if (!project) fail("Pilih project yang aktif.");
      if (row.isActive) {
        const [duplicate] = await tx
          .select({ id: projectAssignments.id })
          .from(projectAssignments)
          .where(
            and(
              eq(projectAssignments.workerId, person.id),
              eq(projectAssignments.projectId, project.id),
              eq(projectAssignments.assignmentType, "ongoing"),
              eq(projectAssignments.isActive, true),
            ),
          )
          .for("update");
        if (duplicate && duplicate.id !== row.id)
          fail("Pengguna sudah memiliki penempatan aktif pada project ini.");
      }
      const changingUser = row.workerId !== person.id;
      const changingProject = row.projectId !== project.id;
      const corrections =
        changingUser || changingProject
          ? await correctOpenAttendance(tx, row, changingUser ? null : project)
          : [];
      if (changingUser) {
        // Never attach the old user's history to a new employee's placement.
        await tx
          .update(attendances)
          .set({ projectAssignmentId: null })
          .where(eq(attendances.projectAssignmentId, row.id));
        await tx
          .update(absences)
          .set({ assignmentId: null })
          .where(eq(absences.assignmentId, row.id));
      }
      await tx
        .update(projectAssignments)
        .set({
          workerId: person.id,
          projectId: project.id,
          updatedById: actor.id,
        })
        .where(eq(projectAssignments.id, row.id));
      await tx
        .delete(notifications)
        .where(eq(notifications.assignmentId, row.id));
      if (row.isActive)
        await tx.insert(notifications).values({
          id: randomUUID(),
          recipientId: person.id,
          assignmentId: row.id,
          initialKey: row.id,
          projectName: project.name,
          projectAddress: project.address,
        });
      await recordActivity(
        tx,
        actor,
        "assignments",
        "edit",
        `${person.name} → ${project.name} · Koreksi penempatan ${row.assignmentCode} · Project sebelumnya ${row.projectId} · Pengguna sebelumnya ${row.workerId} · ${corrections.length} absensi terbuka dikoreksi${corrections.length ? ` · ID: ${corrections.map((r) => r.id).join(", ")}` : ""}`,
      );
    });
    refresh();
    revalidatePath("/admin/dashboard");
    return { success: "Penempatan berhasil diperbarui." };
  } catch {
    return { error: expectedError || "Penempatan belum dapat diperbarui." };
  }
}
