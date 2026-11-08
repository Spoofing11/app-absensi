import "server-only";
import { and, eq, desc } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { attendances } from "@/lib/server/db/schema";
import { env } from "@/lib/server/env";
// A new calendar date starts a new attendance. Old open records remain reviewable.
export async function currentAttendance(connection, userId, now = new Date()) {
  const today = formatInTimeZone(now, env.APP_TIMEZONE, "yyyy-MM-dd");
  const [row] = await connection
    .select()
    .from(attendances)
    .where(and(eq(attendances.userId, userId), eq(attendances.workDate, today)))
    .orderBy(desc(attendances.checkInAt), desc(attendances.id))
    .limit(1);
  return { row: row || null, workDate: today };
}
