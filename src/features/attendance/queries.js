import "server-only";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { attendances } from "@/lib/server/db/schema";
import { env } from "@/lib/server/env";
export async function currentAttendance(connection, userId, now = new Date()) {
  const today = formatInTimeZone(now, env.APP_TIMEZONE, "yyyy-MM-dd");
  const previous = new Date(`${today}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const rows = await connection
    .select()
    .from(attendances)
    .where(
      and(
        eq(attendances.userId, userId),
        gte(attendances.workDate, previous.toISOString().slice(0, 10)),
        lte(attendances.workDate, today),
      ),
    )
    .orderBy(desc(attendances.workDate), desc(attendances.checkInAt));
  const row =
    rows.find((item) => item.workDate === today) ||
    rows.find(
      (item) =>
        !item.checkOutAt &&
        formatInTimeZone(
          item.scheduledEndAt,
          item.timezoneSnapshot,
          "yyyy-MM-dd",
        ) === today &&
        formatInTimeZone(
          item.scheduledStartAt,
          item.timezoneSnapshot,
          "yyyy-MM-dd",
        ) !== today,
    );
  return { row: row || null, workDate: row?.workDate || today };
}
