"use server";
import { recordActivity } from "@/features/activity-logs/server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { workSchedules, roles, projects } from "@/lib/server/db/schema";
import { requirePermission } from "@/lib/server/auth/permissions";
export async function saveSchedule(form) {
  const editing = !!form.get("id");
  const actor = await requirePermission(
    "schedules",
    editing ? "edit" : "create",
  );
  const id = z.uuid().parse(form.get("id") || randomUUID());
  const data = z
    .object({
      name: z.string().trim().min(1).max(100),
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    })
    .parse(Object.fromEntries(form));
  if (data.startTime === data.endTime)
    throw new Error("Jam masuk dan pulang tidak boleh sama.");
  const isActive = form.get("isActive") === "on";
  await db.transaction(async (tx) => {
    if (editing) {
      const [existing] = await tx
        .select()
        .from(workSchedules)
        .where(eq(workSchedules.id, id))
        .for("update");
      if (!existing) throw new Error("Jadwal tidak ditemukan.");
      if (!isActive) {
        const [role] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.workScheduleId, id))
          .limit(1);
        const [project] = await tx
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.workScheduleId, id))
          .limit(1);
        if (role || project)
          throw new Error(
            "Lepaskan jadwal dari Role dan Project sebelum menonaktifkannya.",
          );
      }
      await tx
        .update(workSchedules)
        .set({ ...data, isActive, updatedById: actor.id })
        .where(eq(workSchedules.id, id));
    } else
      await tx.insert(workSchedules).values({
        ...data,
        id,
        isActive,
        scheduleCode: `SCH-${id.slice(0, 8)}`,
        createdById: actor.id,
      });
    await recordActivity(tx, actor, "schedules", editing ? "edit" : "create", data.name);
  });
  revalidatePath("/", "layout");
}
export async function deleteSchedule(form) {
  const actor = await requirePermission("schedules", "delete");
  const id = z.uuid().parse(form.get("id"));
  await db.transaction(async (tx) => {
    const [target] = await tx.select({ name: workSchedules.name }).from(workSchedules)
      .where(eq(workSchedules.id, id)).for("update");
    if (!target) return;
    await tx.delete(workSchedules).where(eq(workSchedules.id, id));
    await recordActivity(tx, actor, "schedules", "delete", target.name);
  });
  revalidatePath("/schedules");
}
