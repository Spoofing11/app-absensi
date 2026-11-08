"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { attendances, users } from "@/lib/server/db/schema";
import { requirePermission } from "@/lib/server/auth/permissions";
import { recordActivity } from "@/features/activity-logs/server";
import { env } from "@/lib/server/env";
export async function reviewAttendance(form) {
  const actor = await requirePermission("approvals", "edit");
  await requirePermission("approvals", "read");
  const parsed = z
    .object({
      id: z.uuid(),
      status: z.enum(["approved", "rejected"]),
      reason: z.string().trim().max(2000),
    })
    .safeParse({
      id: form.get("id"),
      status: form.get("status"),
      reason: form.get("reason") || "",
    });
  if (!parsed.success)
    return { error: "Keputusan tidak valid. Alasan maksimal 2000 karakter." };
  const { id, status, reason } = parsed.data;
  if (status === "rejected" && !reason)
    return { error: "Alasan penolakan wajib diisi." };
  try {
    await db.transaction(async (tx) => {
      const [found] = await tx
        .select({ userId: attendances.userId })
        .from(attendances)
        .where(eq(attendances.id, id));
      if (!found) throw new Error("Catatan tidak ditemukan.");
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, found.userId))
        .for("update");
      const [row] = await tx
        .select()
        .from(attendances)
        .where(eq(attendances.id, id))
        .for("update");
      if (!row || row.approvalStatus !== "pending")
        throw new Error("Catatan sudah diproses. Muat ulang daftar.");
      const today = formatInTimeZone(
        new Date(),
        env.APP_TIMEZONE,
        "yyyy-MM-dd",
      );
      if (!row.checkOutAt && row.workDate >= today)
        throw new Error(
          "Tunggu absen pulang atau pergantian hari untuk memproses catatan ini.",
        );
      await tx
        .update(attendances)
        .set({
          approvalStatus: status,
          approvalReason: reason || null,
          reviewedById: actor.id,
          reviewedByName: actor.name,
          reviewedAt: new Date(),
        })
        .where(
          and(
            eq(attendances.id, id),
            eq(attendances.approvalStatus, "pending"),
          ),
        );
      await recordActivity(
        tx,
        actor,
        "approvals",
        status === "approved" ? "approve" : "reject",
        `${row.fullNameSnapshot} · ${row.workDate} · ${row.projectNameSnapshot || "Tanpa project"}${reason ? ` · ${reason}` : ""}`,
      );
    });
  } catch (error) {
    const known = [
      "Catatan tidak ditemukan.",
      "Catatan sudah diproses. Muat ulang daftar.",
      "Tunggu absen pulang atau pergantian hari untuk memproses catatan ini.",
    ];
    return {
      error: known.includes(error.message)
        ? error.message
        : "Keputusan belum dapat disimpan.",
    };
  }
  for (const path of [
    "/approvals",
    "/history",
    "/photo-recap",
    "/admin/dashboard",
    "/dashboard",
  ])
    revalidatePath(path);
  return { success: "Keputusan berhasil disimpan." };
}
