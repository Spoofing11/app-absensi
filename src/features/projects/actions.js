"use server";
import { recordActivity } from "@/features/activity-logs/server";
import { assertActiveSchedule } from "@/features/schedules/validation";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { projects } from "@/lib/server/db/schema";
import { requirePermission } from "@/lib/server/auth/permissions";
export async function saveProject(form) {
  const editing = !!form.get("id");
  const user = await requirePermission("projects", editing ? "edit" : "create");
  const id = z.uuid().parse(form.get("id") || randomUUID());
  const data = z
    .object({
      name: z.string().trim().min(1).max(150),
      workScheduleId: z.uuid(),
      address: z.string().trim().min(1).max(5000),
    })
    .parse(Object.fromEntries(form));
  await db.transaction(async (tx) => {
    await assertActiveSchedule(tx, data.workScheduleId);
    if (editing) {
      const [existing] = await tx.select({ id: projects.id }).from(projects)
        .where(eq(projects.id, id)).for("update");
      if (!existing) throw new Error("Project tidak ditemukan.");
      await tx
        .update(projects)
        .set({ ...data, updatedById: user.id })
        .where(eq(projects.id, id));
    } else
      await tx
        .insert(projects)
        .values({
          ...data,
          id,
          projectCode: `PRJ-${id.slice(0, 8)}`,
          createdById: user.id,
        });
    await recordActivity(tx, user, "projects", editing ? "edit" : "create", data.name);
  });
  revalidatePath("/projects");
  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  revalidatePath("/users");
}
export async function deleteProject(form) {
  const actor = await requirePermission("projects", "delete");
  const id = z.uuid().parse(form.get("id"));
  // Foreign keys reject deletion of projects referenced by assignments or attendance.
  await db.transaction(async (tx) => {
    const [target] = await tx.select({ name: projects.name }).from(projects)
      .where(eq(projects.id, id)).for("update");
    if (!target) return;
    await tx.delete(projects).where(eq(projects.id, id));
    await recordActivity(tx, actor, "projects", "delete", target.name);
  });
  revalidatePath("/projects");
  revalidatePath("/assignments");
}
