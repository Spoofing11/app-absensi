import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { requireWorkspace } from "@/lib/server/auth/permissions";
import { db } from "@/lib/server/db";
import { attendances, projectAssignments, projects, users } from "@/lib/server/db/schema";
import { env } from "@/lib/server/env";
import { validWorkDate } from "@/lib/shared/assignment-date";
import { FEATURES } from "@/lib/shared/permissions";
import { durationLabel } from "@/features/attendance/policy";

export default async function Page({ searchParams }) {
  const { user, permissions } = await requireWorkspace();
  if (!permissions.assignments?.read || !permissions.history?.read) {
    return (
      <>
        <div className="page-heading"><h1>Selamat datang, {user.name}.</h1></div>
        <div className="dashboard-links">
          {Object.entries(FEATURES).filter(([key]) => permissions[key]?.read).map(([key, label]) => (
            <Link className="dashboard-link" href={`/${key}`} key={key}><h2>{label}</h2></Link>
          ))}
        </div>
      </>
    );
  }

  const params = await searchParams;
  const today = formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd");
  const date = validWorkDate(params?.date) ? params.date : today;
  const rows = await db.select({
    id: projectAssignments.id,
    projectId: projects.id,
    project: projects.name,
    worker: users.name,
    checkIn: attendances.checkInAt,
    checkOut: attendances.checkOutAt,
    late: attendances.lateSeconds,
    timezone: attendances.timezoneSnapshot,
  }).from(projectAssignments)
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .innerJoin(users, eq(users.id, projectAssignments.workerId))
    .leftJoin(attendances, and(
      eq(attendances.projectAssignmentId, projectAssignments.id),
      eq(attendances.userId, projectAssignments.workerId),
      eq(attendances.workDate, projectAssignments.workDate),
    ))
    .where(eq(projectAssignments.workDate, date))
    .orderBy(projects.name, users.name, desc(attendances.checkInAt), desc(attendances.id));

  const groups = new Map();
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    if (!groups.has(row.projectId)) groups.set(row.projectId, { name: row.project, team: [] });
    groups.get(row.projectId).team.push(row);
  }
  const selected = groups.has(params?.project) ? params.project : "";
  const visible = [...groups].filter(([id]) => !selected || selected === id);
  const team = visible.flatMap(([, group]) => group.team);
  const count = (team) => {
    const inCount = team.filter(row => row.checkIn).length;
    return {
      total: team.length,
      inCount,
      pending: team.length - inCount,
      late: team.filter(row => row.checkIn && row.late > 0).length,
      out: team.filter(row => row.checkOut).length,
    };
  };
  const totals = count(team);
  const formatTime = (value, timezone) => value ? formatInTimeZone(value, timezone || env.APP_TIMEZONE, "HH:mm") : "—";

  return (
    <>
      <div className="page-heading"><div><h1>Dashboard Kehadiran</h1><p>Pantau absensi tukang berdasarkan penempatan project.</p></div></div>
      <form className="content-card assignment-filter" method="get">
        <label>Tanggal kerja<input type="date" name="date" defaultValue={date} required /></label>
        <label>Project<select name="project" defaultValue={selected}>
          <option value="">Semua Project</option>
          {[...groups].map(([id, group]) => <option key={id} value={id}>{group.name}</option>)}
        </select></label>
        <button className="admin-button" type="submit">Terapkan</button>
        <Link className="admin-button secondary" href="/admin/dashboard">Hari Ini</Link>
      </form>
      <div className="stats-grid attendance-analytics-stats">
        {[["Dijadwalkan", totals.total], ["Sudah Masuk", totals.inCount], ["Belum Absen", totals.pending], ["Terlambat", totals.late]].map(([label, value]) => (
          <article className="stat-card" key={label}><span className="stat-label">{label}</span><strong>{value}</strong><small>tukang</small></article>
        ))}
      </div>
      <section className="content-card attendance-analytics-projects">
        <h2>Kehadiran per Project</h2>
        <p className="muted">Sudah Masuk mencakup tukang yang sudah absen pulang.</p>
        {visible.length ? (
          <>
            <div className="analytics-project-row analytics-project-head" aria-hidden="true">
              <span>Project</span><span>Dijadwalkan</span><span>Masuk</span><span>Belum Absen</span><span>Terlambat</span><span>Pulang</span><span>Aksi</span>
            </div>
            {visible.map(([id, group]) => {
              const stats = count(group.team);
              return <details className="analytics-project" key={id}>
                <summary className="analytics-project-row">
                  <strong>{group.name}</strong>
                  {[["Dijadwalkan", stats.total], ["Masuk", stats.inCount], ["Belum Absen", stats.pending], ["Terlambat", stats.late], ["Pulang", stats.out]].map(([label, value]) => (
                    <span key={label}><span className="analytics-mobile-label">{label}</span><span className="sr-only analytics-desktop-label">{label}: </span>{value}</span>
                  ))}
                  <span className="analytics-detail-label">Detail</span>
                </summary>
                <div className="table-scroll" tabIndex={0} role="region" aria-label={`Detail ${group.name}`}>
                  <table className="admin-table">
                    <thead><tr><th>Tukang</th><th>Jam Masuk</th><th>Jam Pulang</th><th>Status</th></tr></thead>
                    <tbody>{group.team.map(row => (
                      <tr key={row.id}>
                        <td>{row.worker}</td><td>{formatTime(row.checkIn, row.timezone)}</td><td>{formatTime(row.checkOut, row.timezone)}</td>
                        <td>{row.checkOut ? "Sudah pulang" : row.checkIn ? "Sudah masuk" : "Belum absen"}{row.late > 0 && <small className="block muted">Terlambat {durationLabel(row.late)}</small>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </details>;
            })}
          </>
        ) : <div className="empty-state"><p>Belum ada penempatan untuk tanggal ini.</p></div>}
      </section>
    </>
  );
}
