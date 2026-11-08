import Link from "next/link";
import { db } from "@/lib/server/db";
import {
  users,
  roles,
  projects,
  projectAssignments,
  attendances,
  absences,
} from "@/lib/server/db/schema";
import { eq, ne, desc, and, isNotNull } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { env } from "@/lib/server/env";
import {
  requirePermission,
  permissionsFor,
} from "@/lib/server/auth/permissions";
import OngoingAssignments from "@/features/assignments/OngoingAssignments";
import AssignmentPanel from "@/features/assignments/AssignmentPanel";

export const metadata = { title: "Penempatan Project" };

export default async function AssignmentsPage({ searchParams }) {
  const actor = await requirePermission("assignments");
  const params = await searchParams;
  const tab = params?.tab === "tukang" ? "tukang" : "karyawan";
  const permissions = (await permissionsFor(actor)).assignments;
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      roleId: users.roleId,
      employeeType: users.employeeType,
      role: users.role,
      roleName: roles.name,
    })
    .from(users)
    .leftJoin(roles, eq(roles.id, users.roleId))
    .where(and(eq(users.isActive, true), ne(users.role, "admin")))
    .orderBy(users.name);
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
      assignmentType: projectAssignments.assignmentType,
      isActive: projectAssignments.isActive,
      role: users.role,
      roleId: users.roleId,
      roleName: roles.name,
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
    .leftJoin(roles, eq(roles.id, users.roleId))
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
  const absenceRows = await db
    .select({
      id: absences.assignmentId,
      date: absences.workDate,
      status: absences.status,
    })
    .from(absences)
    .where(isNotNull(absences.assignmentId));
  const absenceByAssignment = new Map(
    absenceRows.map((row) => [`${row.id}:${row.date}`, row.status]),
  );
  for (const row of absenceRows) used.add(row.id);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Penempatan Project</h1>
          <p>Kelola penempatan harian dan project aktif pengguna.</p>
        </div>
      </div>
      <nav
        className="assignment-tabs placement-main-tabs"
        aria-label="Jenis penempatan"
      >
        <Link
          href="/assignments?tab=karyawan"
          className={tab === "karyawan" ? "active" : ""}
          aria-current={tab === "karyawan" ? "page" : undefined}
        >
          Karyawan
        </Link>
        <Link
          href="/assignments?tab=tukang"
          className={tab === "tukang" ? "active" : ""}
          aria-current={tab === "tukang" ? "page" : undefined}
        >
          Tukang
        </Link>
      </nav>
      {tab === "karyawan" ? (
        <OngoingAssignments
          rows={rows
            .filter((row) => row.assignmentType === "ongoing")
            .map((row) => ({ ...row, used: used.has(row.id) }))}
          users={members.filter((u) => u.employeeType === "karyawan")}
          projects={projectRows}
          permissions={permissions}
        />
      ) : (
        <AssignmentPanel
          permissions={permissions}
          rows={rows
            .filter((row) => row.assignmentType === "daily")
            .map((row) => ({
              ...row,
              used: used.has(row.id),
              attendanceStatus:
                attendanceByAssignment.get(`${row.id}:${row.workDate}`) ||
                absenceByAssignment.get(`${row.id}:${row.workDate}`) ||
                "none",
            }))}
          workers={workers}
          projects={projectRows}
          today={formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd")}
        />
      )}
    </>
  );
}
