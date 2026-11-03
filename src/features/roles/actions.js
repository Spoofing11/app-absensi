"use server";
import { assertActiveSchedule } from "@/features/schedules/validation";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { roles, rolePermissions, users } from "@/lib/server/db/schema";
import { requirePermission } from "@/lib/server/auth/permissions";
import { FEATURES, OPERATIONS } from "@/lib/shared/permissions";
export async function saveRole(form) {
  const id = form.get("id") || randomUUID();
  const editing = !!form.get("id");
  await requirePermission("roles", editing ? "edit" : "create");
  z.uuid().parse(id);
  const workScheduleId =
    z
      .union([z.uuid(), z.literal("")])
      .parse(form.get("workScheduleId") || "") || null;
  const name = z.string().trim().min(1).max(100).parse(form.get("name"));
  await db.transaction(async (tx) => {
    await assertActiveSchedule(tx, workScheduleId);
    if (editing) {
      const [role] = await tx
        .select()
        .from(roles)
        .where(eq(roles.id, id))
        .for("update");
      if (!role || role.isSystem) throw new Error("Role sistem dilindungi.");
      await tx
        .update(roles)
        .set({ name, workScheduleId })
        .where(eq(roles.id, id));
    } else await tx.insert(roles).values({ id, name, workScheduleId });
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    await tx.insert(rolePermissions).values(
      Object.keys(FEATURES).map((feature) => ({
        roleId: id,
        feature,
        ...Object.fromEntries(
          OPERATIONS.map((op) => [
            op,
            feature === "history" && op !== "read"
              ? false
              : form.get(`${feature}.${op}`) === "on",
          ]),
        ),
      })),
    );
  });
  revalidatePath("/roles");
  revalidatePath("/", "layout");
}
export async function deleteRole(form) {
  await requirePermission("roles", "delete");
  const id = z.uuid().parse(form.get("id"));
  await db.transaction(async (tx) => {
    const [role] = await tx
      .select()
      .from(roles)
      .where(eq(roles.id, id))
      .for("update");
    if (!role || role.isSystem) throw new Error("Role sistem dilindungi.");
    const [used] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.roleId, id))
      .limit(1);
    if (used) throw new Error("Role masih digunakan oleh user.");
    await tx.delete(roles).where(eq(roles.id, id));
  });
  revalidatePath("/roles");
}
