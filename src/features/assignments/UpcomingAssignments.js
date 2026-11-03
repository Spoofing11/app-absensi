import "server-only";
import { and, eq, gt, asc } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { projectAssignments, projects } from "@/lib/server/db/schema";
import { requireUser } from "@/lib/server/auth/session";
import { assignmentDateLabel } from "@/lib/shared/assignment-date";

export default async function UpcomingAssignments() {
  const user = await requireUser();
  if (user.employeeType !== "tukang") return null;
  const today = formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd");
  const rows = await db
    .select({
      id: projectAssignments.id,
      workDate: projectAssignments.workDate,
      name: projects.name,
      address: projects.address,
    })
    .from(projectAssignments)
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .where(
      and(
        eq(projectAssignments.workerId, user.id),
        gt(projectAssignments.workDate, today),
        eq(projects.status, "active"),
      ),
    )
    .orderBy(asc(projectAssignments.workDate))
    .limit(7);
  if (!rows.length) return null;
  return (
    <section className="content-card upcoming-assignments">
      <p className="eyebrow">PENEMPATAN KERJA</p>
      <h2>Penempatan Berikutnya</h2>
      <p className="muted">
        Jadwal penempatan yang sudah disiapkan untuk Anda. Menampilkan hingga 7
        penempatan terdekat.
      </p>
      <ul className="assignment-team">
        {rows.map((row) => (
          <li key={row.id}>
            <div>
              <strong>{row.name}</strong>
              <small>{row.address}</small>
            </div>
            <span>{assignmentDateLabel(row.workDate)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
