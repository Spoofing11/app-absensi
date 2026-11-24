import "server-only";
import { desc, eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser } from "@/lib/server/auth/session";
import { isSystemAdministrator } from "@/features/activity-logs/server";
import { db } from "@/lib/server/db";
import { attendanceTimeCorrections } from "@/lib/server/db/schema";
import { attendanceVersion, nextDate } from "./validation";

export async function correctionData(row, requestedPage) {
  const actor = await requireUser();
  if (row.absenceStatus || !(await isSystemAdministrator(actor))) return null;
  const requested = Number(requestedPage);
  const page =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, 100000)
      : 1;
  const rows = await db
    .select()
    .from(attendanceTimeCorrections)
    .where(eq(attendanceTimeCorrections.attendanceId, row.id))
    .orderBy(desc(attendanceTimeCorrections.revision))
    .limit(11)
    .offset((page - 1) * 10);
  const [latest] = await db
    .select({ revision: attendanceTimeCorrections.revision })
    .from(attendanceTimeCorrections)
    .where(eq(attendanceTimeCorrections.attendanceId, row.id))
    .orderBy(desc(attendanceTimeCorrections.revision))
    .limit(1);
  const [original] = await db
    .select()
    .from(attendanceTimeCorrections)
    .where(eq(attendanceTimeCorrections.attendanceId, row.id))
    .orderBy(attendanceTimeCorrections.revision)
    .limit(1);
  const time = (value, pattern) =>
    value ? formatInTimeZone(value, row.timezoneSnapshot, pattern) : "";
  return {
    page,
    hasNext: rows.length > 10,
    rows: rows.slice(0, 10),
    original: original?.beforeState,
    form: {
      id: row.id,
      version: attendanceVersion(row),
      revision: latest?.revision || 0,
      workDate: row.workDate,
      timezone: row.timezoneSnapshot,
      maxCheckoutDate: nextDate(row.workDate),
      checkIn: time(row.checkInAt, "HH:mm:ss"),
      checkOut: time(row.checkOutAt, "HH:mm:ss"),
      checkoutDate: time(row.checkOutAt, "yyyy-MM-dd"),
      approvalStatus: row.approvalStatus,
    },
  };
}
