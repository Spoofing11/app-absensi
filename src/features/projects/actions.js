"use server";
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
    if (editing)
      await tx
        .update(projects)
        .set({ ...data, updatedById: user.id })
        .where(eq(projects.id, id));
    else
      await tx
        .insert(projects)
        .values({
          ...data,
          id,
          projectCode: `PRJ-${id.slice(0, 8)}`,
          createdById: user.id,
        });
  });
  revalidatePath("/projects");
  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  revalidatePath("/users");
}
export async function deleteProject(form) {
  await requirePermission("projects", "delete");
  const id = z.uuid().parse(form.get("id"));
  // Foreign keys reject deletion of projects referenced by assignments or attendance.
  await db.delete(projects).where(eq(projects.id, id));
  revalidatePath("/projects");
  revalidatePath("/assignments");
}
