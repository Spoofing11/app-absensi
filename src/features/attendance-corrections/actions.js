"use server";
import { randomUUID } from "node:crypto";
import { formatInTimeZone } from "date-fns-tz";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/auth/session";
import { db } from "@/lib/server/db";
import {
  attendances,
  attendanceTimeCorrections,
  users,
  roles,
} from "@/lib/server/db/schema";
import {
  isSystemAdministrator,
  recordActivity,
} from "@/features/activity-logs/server";
import {
  attendanceState,
  attendanceVersion,
  correctedTimes,
  correctionInput,
  CorrectionError,
} from "./validation";

export async function correctAttendanceTime(form) {
  const actor = await requireUser();
  if (!(await isSystemAdministrator(actor)))
    return { error: "Hanya Administrator yang dapat mengoreksi waktu." };
  const parsed = correctionInput.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "Periksa jam dan alasan koreksi (5–1000 karakter)." };
  const input = parsed.data;
  try {
    await db.transaction(async (tx) => {
      const [found] = await tx
        .select({ userId: attendances.userId })
        .from(attendances)
        .where(eq(attendances.id, input.id));
      if (!found) throw new CorrectionError("Catatan tidak ditemukan.");
      let freshActor;
      for (const userId of [...new Set([actor.id, found.userId])].sort()) {
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .for("update");
        if (userId === actor.id) freshActor = user;
      }
      const [role] = freshActor?.roleId
        ? await tx
            .select()
            .from(roles)
            .where(eq(roles.id, freshActor.roleId))
            .for("share")
        : [];
      if (
        !freshActor?.isActive ||
        freshActor.role !== "admin" ||
        !role?.isSystem
      )
        throw new CorrectionError(
          "Hanya Administrator yang dapat mengoreksi waktu.",
        );
      const [row] = await tx
        .select()
        .from(attendances)
        .where(eq(attendances.id, input.id))
        .for("update");
      const [latest] = await tx
        .select({ revision: attendanceTimeCorrections.revision })
        .from(attendanceTimeCorrections)
        .where(eq(attendanceTimeCorrections.attendanceId, input.id))
        .orderBy(desc(attendanceTimeCorrections.revision))
        .limit(1)
        .for("update");
      if (
        !row ||
        row.userId !== found.userId ||
        attendanceVersion(row) !== input.version ||
        (latest?.revision || 0) !== input.revision
      )
        throw new CorrectionError(
          "Data absensi sudah berubah. Muat ulang halaman sebelum koreksi.",
        );
      const changes = correctedTimes(row, input);
      const updatedAt = new Date();
      await tx
        .update(attendances)
        .set({ ...changes, updatedAt })
        .where(eq(attendances.id, row.id));
      await tx.insert(attendanceTimeCorrections).values({
        id: randomUUID(),
        attendanceId: row.id,
        revision: input.revision + 1,
        actorUserId: freshActor.id,
        actorName: freshActor.name,
        actorUsername: freshActor.username,
        timezone: row.timezoneSnapshot,
        reason: input.reason,
        beforeState: attendanceState(row),
        afterState: attendanceState({ ...row, ...changes, updatedAt }),
      });
      const displayTime = (value) =>
        value
          ? formatInTimeZone(value, row.timezoneSnapshot, "yyyy-MM-dd HH:mm:ss")
          : "Belum tercatat";
      await recordActivity(
        tx,
        freshActor,
        "attendance-corrections",
        "correct_time",
        `${row.fullNameSnapshot} · ${row.timezoneSnapshot} · Masuk ${displayTime(row.checkInAt)} → ${displayTime(changes.checkInAt)} · Pulang ${displayTime(row.checkOutAt)} → ${displayTime(changes.checkOutAt)} · ${input.reason}`,
      );
    });
  } catch (error) {
    return {
      error:
        error instanceof CorrectionError
          ? error.message
          : "Koreksi belum dapat disimpan. Coba lagi.",
    };
  }
  for (const path of [
    "/history",
    `/history/${input.id}`,
    "/photo-recap",
    "/approvals",
    "/admin/dashboard",
    "/dashboard",
    "/attendance",
  ])
    revalidatePath(path);
  return { success: "Koreksi waktu berhasil disimpan." };
}
