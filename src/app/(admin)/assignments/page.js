import { db } from "@/lib/server/db";
import {
  users,
  projects,
  projectAssignments,
  attendances,
} from "@/lib/server/db/schema";
import { eq, desc, and, isNotNull } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { env } from "@/lib/server/env";
import {
  requirePermission,
  permissionsFor,
} from "@/lib/server/auth/permissions";
import AssignmentPanel from "@/features/assignments/AssignmentPanel";

export const metadata = { title: "Penempatan Tukang" };

export default async function AssignmentsPage() {
  const actor = await requirePermission("assignments");
  const workers = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.employeeType, "tukang"), eq(users.isActive, true)))
    .orderBy(users.name);
  const projectRows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.status, "active"))
    .orderBy(projects.name);
  const rows = await db
    .select({
      id: projectAssignments.id,
      workerId: projectAssignments.workerId,
      projectId: projectAssignments.projectId,
      workDate: projectAssignments.workDate,
      worker: users.name,
      project: projects.name,
      address: projects.address,
    })
    .from(projectAssignments)
    .innerJoin(users, eq(users.id, projectAssignments.workerId))
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .orderBy(desc(projectAssignments.workDate), projects.name, users.name);
  const attendanceRows = await db
    .select({
      id: attendances.projectAssignmentId,
      workDate: attendances.workDate,
      checkOutAt: attendances.checkOutAt,
    })
    .from(attendances)
    .where(isNotNull(attendances.projectAssignmentId));
  const used = new Set(attendanceRows.map((row) => row.id));
  const attendanceByAssignment = new Map();
  for (const row of attendanceRows) {
    const key = `${row.id}:${row.workDate}`;
    // If legacy data has several records, an open check-in takes precedence.
    if (!attendanceByAssignment.has(key) || !row.checkOutAt)
      attendanceByAssignment.set(key, row.checkOutAt ? "out" : "in");
  }
  return (
    <AssignmentPanel
      permissions={(await permissionsFor(actor)).assignments}
      rows={rows.map((row) => ({
        ...row,
        used: used.has(row.id),
        attendanceStatus:
          attendanceByAssignment.get(`${row.id}:${row.workDate}`) || "none",
      }))}
      workers={workers}
      projects={projectRows}
      today={formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd")}
    />
  );
}
