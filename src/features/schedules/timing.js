import { fromZonedTime } from "date-fns-tz";
export function attendanceTiming(
  workDate,
  schedule,
  timezone,
  now = new Date(),
) {
  const scheduledStartAt = fromZonedTime(
    `${workDate}T${schedule.startTime}`,
    timezone,
  );
  let scheduledEndAt = fromZonedTime(
    `${workDate}T${schedule.endTime}`,
    timezone,
  );
  if (scheduledEndAt <= scheduledStartAt) {
    const next = new Date(`${workDate}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    scheduledEndAt = fromZonedTime(
      `${next.toISOString().slice(0, 10)}T${schedule.endTime}`,
      timezone,
    );
  }
  return {
    scheduledStartAt,
    scheduledEndAt,
    lateSeconds: Math.max(0, Math.floor((now - scheduledStartAt) / 1000)),
  };
}
