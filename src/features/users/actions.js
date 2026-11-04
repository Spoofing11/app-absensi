"use server";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { users, accounts, roles, sessions } from "@/lib/server/db/schema";
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
  if (accessRole.isSystem && admin.role !== "admin")
    throw new Error("Hanya Admin utama yang dapat memberikan role Admin.");

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
  });
  revalidatePath("/users");
}
export async function deactivateUser(form) {
  const admin = await requirePermission("users", "delete");
  const id = z.uuid().parse(form.get("id"));
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (target?.role === "admin") throw new Error("Akun Admin utama dilindungi.");
  if (id === admin.id)
    throw new Error("Tidak dapat menonaktifkan akun sendiri.");
  await db
    .update(users)
    .set({ isActive: false, updatedById: admin.id })
    .where(eq(users.id, id));
  revalidatePath("/users");
}
