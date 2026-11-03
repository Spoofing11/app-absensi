import Link from "next/link";
import UpcomingAssignments from "@/features/assignments/UpcomingAssignments";
import { canUseAttendance } from "@/lib/shared/attendance-access";
import PersonalHistory from "@/features/attendance-history/PersonalHistory";
import { permissionsFor } from "@/lib/server/auth/permissions";
import { requireUser } from "@/lib/server/auth/session";
import WorkerShell from "@/components/app/WorkerShell";
import AttendancePanel from "@/features/attendance/components/AttendancePanel";
import { attendanceContext } from "@/features/attendance/actions";
import { FEATURES } from "@/lib/shared/permissions";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }) {
  const user = await requireUser();
  const permissions = await permissionsFor(user);
  const canManage = [
    "users",
    "roles",
    "projects",
    "assignments",
    "schedules",
    "history",
  ].some((f) => permissions[f]?.read);
  const canAttend = canUseAttendance(user);
  return (
    <WorkerShell user={user} canManage={canManage}>
      {canAttend ? (
        <>
          <AttendancePanel initialContext={await attendanceContext()} />
          <UpcomingAssignments />
          <PersonalHistory searchParams={await searchParams} />
        </>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <p className="eyebrow">PORTAL KERJA</p>
              <h1>Selamat datang, {user.name}.</h1>
              <p>Pilih fitur yang tersedia untuk akun Anda.</p>
            </div>
          </div>
          {canManage ? (
            <div className="dashboard-links">
              {Object.entries(FEATURES)
                .filter(
                  ([key]) => key !== "attendance" && permissions[key]?.read,
                )
                .map(([key, label]) => (
                  <Link href={`/${key}`} className="dashboard-link" key={key}>
                    <h2>{label}</h2>
                    <p>Buka pengelolaan</p>
                  </Link>
                ))}
            </div>
          ) : (
            <section className="content-card">
              <h2>Belum ada fitur yang tersedia</h2>
              <p className="muted mt-3">
                Hubungi Admin untuk memeriksa hak akses akun Anda.
              </p>
            </section>
          )}
        </>
      )}
      {!canAttend && <PersonalHistory searchParams={await searchParams} />}
    </WorkerShell>
  );
}
