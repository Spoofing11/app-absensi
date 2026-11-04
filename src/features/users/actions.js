"use server";
import { recordActivity } from "@/features/activity-logs/server";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/server/db";
import {
  users, accounts, roles, sessions, attendances, projectAssignments, mediaFiles,
} from "@/lib/server/db/schema";
import { deletePhoto } from "@/lib/server/photo-storage";
import { requirePermission } from "@/lib/server/auth/permissions";
import { passwordError } from "@/lib/shared/password";
import { isValidUsername, normalizeUsername } from "@/lib/shared/username";
export async function saveUser(form) {
  const editing = !!form.get("id");
  const admin = await requirePermission("users", editing ? "edit" : "create");
  const data = z
    .object({
      username: z.string().min(3).max(50),
      name: z.string().trim().min(1).max(150),
      email: z.email(),
      password: z.string(),
      roleId: z.uuid(),
      employeeType: z.enum(["karyawan", "tukang", "none"]),
    })
    .parse(Object.fromEntries(form));
  data.username = normalizeUsername(data.username);
  if (!isValidUsername(data.username)) throw new Error("Username tidak valid.");
  const [accessRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.id, data.roleId));
  if (!accessRole) throw new Error("Role tidak ditemukan.");
  if (accessRole.isSystem && (!editing || admin.role !== "admin"))
    throw new Error("Role Administrator sistem tidak tersedia untuk akun baru.");

  if (!editing && !data.password) throw new Error("Password wajib diisi.");
  if (data.password) {
    const message = passwordError(data.password);
    if (message) throw new Error(message);
  }
  const attendanceEnabled = form.get("attendanceEnabled") === "on";
  const employeeType = attendanceEnabled ? data.employeeType : "none";
  if (attendanceEnabled && !["karyawan", "tukang"].includes(employeeType))
    throw new Error("Pilih jenis pekerja untuk mengaktifkan absensi.");
  const id = z.uuid().parse(form.get("id") || randomUUID());
  const password = data.password ? await hashPassword(data.password) : null;
  await db.transaction(async (tx) => {
    if (editing) {
      const [target] = await tx
        .select()
        .from(users)
        .where(eq(users.id, id))
        .for("update");
      if (!target) throw new Error("User tidak ditemukan.");
      if (accessRole.isSystem && target.roleId !== data.roleId)
        throw new Error("Role Administrator sistem tidak dapat diberikan ke akun lain.");
      if (
        target.role === "admin" &&
        (admin.role !== "admin" || data.roleId !== target.roleId)
      )
        throw new Error("Role Administrator sistem dilindungi.");
      if (id === admin.id && data.roleId !== target.roleId)
        throw new Error("Tidak dapat mengubah Role akses akun sendiri.");
      await tx
        .update(users)
        .set({
          username: data.username,
          displayUsername: data.username,
          name: data.name,
          email: data.email,
          role: accessRole.isSystem
            ? "admin"
            : data.employeeType === "tukang"
              ? "tukang"
              : "karyawan",
          roleId: data.roleId,
          employeeType,
          attendanceEnabled,
          updatedById: admin.id,
        })
        .where(eq(users.id, id));
      if (password) {
        const [credential] = await tx
          .select({ id: accounts.id })
          .from(accounts)
          .where(
            and(eq(accounts.userId, id), eq(accounts.providerId, "credential")),
          )
          .for("update");
        if (!credential)
          throw new Error(
            "Akun tidak memiliki password lokal yang dapat diperbarui.",
          );
        await tx
          .update(accounts)
          .set({ password })
          .where(eq(accounts.id, credential.id));
        await tx
          .update(users)
          .set({ passwordChangedAt: new Date() })
          .where(eq(users.id, id));
        await tx.delete(sessions).where(eq(sessions.userId, id));
      }
      await recordActivity(tx, admin, "users", "edit", `@${data.username}`);
      return;
    }
    await tx.insert(users).values({
      id,
      username: data.username,
      displayUsername: data.username,
      name: data.name,
      email: data.email,
      role: accessRole.isSystem
        ? "admin"
        : data.employeeType === "tukang"
          ? "tukang"
          : "karyawan",
      roleId: data.roleId,
      employeeType,
      attendanceEnabled,
      userCode: `USR-${id.slice(0, 8)}`,
      createdById: admin.id,
    });
    await tx.insert(accounts).values({
      id: randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password,
    });
    await recordActivity(tx, admin, "users", "create", `@${data.username}`);
  });
  revalidatePath("/users");
}
export async function deactivateUser(form) {
  const admin = await requirePermission("users", "delete");
  const id = z.uuid().parse(form.get("id"));
  if (id === admin.id) throw new Error("Tidak dapat menonaktifkan akun sendiri.");
  await db.transaction(async (tx) => {
    const [target] = await tx.select().from(users).where(eq(users.id, id)).for("update");
    if (!target?.isActive) return;
    if (target.role === "admin") throw new Error("Akun Admin utama dilindungi.");
    await tx.update(users).set({ isActive: false, updatedById: admin.id }).where(eq(users.id, id));
    await recordActivity(tx, admin, "users", "deactivate", `@${target.username}`);
  });
  revalidatePath("/users");
}

async function deletionTarget(tx, actorId, id) {
  if (id === actorId) return { error: "Akun sendiri tidak dapat dihapus." };
  // Match the user-row lock used by attendance, profile, and assignment writes.
  const [target] = await tx.select({
    name: users.name,
    username: users.username,
    role: users.role,
    roleId: users.roleId,
  }).from(users).where(eq(users.id, id)).for("update");
  if (!target) return { error: "User tidak ditemukan." };
  const [role] = target.roleId
    ? await tx.select({ isSystem: roles.isSystem }).from(roles).where(eq(roles.id, target.roleId))
    : [];
  if (target.role === "admin" || role?.isSystem) {
    return { error: "Akun Administrator sistem tidak dapat dihapus." };
  }
  const [{ value: attendanceCount }] = await tx.select({ value: count() })
    .from(attendances).where(eq(attendances.userId, id));
  const [{ value: assignmentCount }] = await tx.select({ value: count() })
    .from(projectAssignments).where(eq(projectAssignments.workerId, id));
  return { name: target.name, username: target.username, attendanceCount, assignmentCount };
}

export async function previewUserDeletion(rawId) {
  const actor = await requirePermission("users", "delete");
  const id = z.uuid().parse(rawId);
  return db.transaction(tx => deletionTarget(tx, actor.id, id));
}

export async function deleteUser(input) {
  const actor = await requirePermission("users", "delete");
  const { id, attendanceCount, assignmentCount } = z.object({
    id: z.uuid(),
    attendanceCount: z.number().int().nonnegative(),
    assignmentCount: z.number().int().nonnegative(),
  }).parse(input);

  const result = await db.transaction(async tx => {
    const target = await deletionTarget(tx, actor.id, id);
    if (target.error) return target;
    if (target.attendanceCount !== attendanceCount || target.assignmentCount !== assignmentCount) {
      return { error: "Data user berubah. Buka kembali konfirmasi untuk melihat jumlah terbaru." };
    }
    const photos = await tx.select({ storageKey: mediaFiles.storageKey })
      .from(mediaFiles).where(eq(mediaFiles.ownerUserId, id));

    await tx.delete(attendances).where(eq(attendances.userId, id));
    await tx.delete(projectAssignments).where(eq(projectAssignments.workerId, id));
    await tx.delete(mediaFiles).where(eq(mediaFiles.ownerUserId, id));
    // The user foreign keys cascade to credentials, sessions, and notifications.
    await tx.delete(users).where(eq(users.id, id));
    await recordActivity(tx, actor, "users", "delete", `@${target.username} · ${attendanceCount} absensi · ${assignmentCount} penempatan`);
    return { photos };
  });
  if (result.error) return result;

  // Delete storage objects only after the database transaction succeeds.
  let failedPhotos = 0;
  for (const { storageKey } of result.photos) {
    try {
      await deletePhoto(storageKey);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      failedPhotos++;
      console.error("User photo cleanup failed", { storageKey, code: error?.code || error?.name });
    }
  }
  for (const route of ["/users", "/assignments", "/projects", "/history", "/admin/dashboard", "/dashboard"]) {
    revalidatePath(route);
  }
  return { failedPhotos };
}
