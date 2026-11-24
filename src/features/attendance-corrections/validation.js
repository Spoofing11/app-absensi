import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { checkoutPolicy, EARLY_REASONS } from "@/features/attendance/policy";

export class CorrectionError extends Error {}
export function attendanceState(row) {
  return JSON.parse(JSON.stringify(row));
}
export function attendanceVersion(row) {
  return createHash("sha256")
    .update(JSON.stringify(attendanceState(row)))
    .digest("hex");
}
export function nextDate(date) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);
export const correctionInput = z.object({
  id: z.uuid(),
  version: z.string().regex(/^[a-f0-9]{64}$/),
  revision: z.coerce.number().int().min(0).max(2147483646),
  checkIn: time,
  checkOut: z.union([time, z.literal("")]),
  checkoutDate: z.string().max(10),
  reason: z.string().trim().min(5).max(1000),
});
function localTime(date, time, timezone) {
  const normalized = time.length === 5 ? `${time}:00` : time;
  const value = fromZonedTime(`${date}T${normalized}`, timezone);
  if (
    !Number.isFinite(value.getTime()) ||
    formatInTimeZone(value, timezone, "yyyy-MM-dd'T'HH:mm:ss") !==
      `${date}T${normalized}`
  )
    throw new CorrectionError("Tanggal atau jam tidak valid.");
  return value;
}
export function correctedTimes(row, input, now = new Date()) {
  const checkInAt = localTime(
    row.workDate,
    input.checkIn,
    row.timezoneSnapshot,
  );
  let checkOutAt = null;
  if (row.checkOutAt) {
    if (
      !input.checkOut ||
      ![row.workDate, nextDate(row.workDate)].includes(input.checkoutDate)
    )
      throw new CorrectionError(
        "Tanggal pulang harus pada tanggal kerja atau hari berikutnya.",
      );
    checkOutAt = localTime(
      input.checkoutDate,
      input.checkOut,
      row.timezoneSnapshot,
    );
  } else if (input.checkOut || input.checkoutDate) {
    throw new CorrectionError(
      "Koreksi ini tidak dapat menambahkan absen pulang yang belum tercatat.",
    );
  }
  if (checkInAt > now || (checkOutAt && checkOutAt > now))
    throw new CorrectionError(
      "Waktu absensi tidak boleh melewati waktu sekarang.",
    );
  if (checkOutAt && checkOutAt < checkInAt)
    throw new CorrectionError("Absen pulang tidak boleh sebelum absen masuk.");
  if (+checkInAt === +row.checkInAt && +checkOutAt === +row.checkOutAt)
    throw new CorrectionError("Belum ada perubahan waktu.");
  const validReason =
    EARLY_REASONS.includes(row.earlyReasonCategory) &&
    row.earlyReasonText?.trim().length >= 5 &&
    row.earlyReasonText.trim().length <= 1000;
  const early = checkOutAt
    ? checkoutPolicy(row.scheduledEndAt, checkOutAt, {
        category: validReason ? row.earlyReasonCategory : "Lainnya",
        text: validReason ? row.earlyReasonText : input.reason,
      })
    : { earlySeconds: 0, earlyReasonCategory: null, earlyReasonText: null };
  return {
    checkInAt,
    checkOutAt,
    lateSeconds: Math.max(
      0,
      Math.floor((checkInAt - row.scheduledStartAt) / 1000),
    ),
    ...early,
    ...(row.approvalStatus === "approved"
      ? {
          approvalStatus: "pending",
          approvalReason: null,
          reviewedById: null,
          reviewedByName: null,
          reviewedAt: null,
        }
      : {}),
  };
}
