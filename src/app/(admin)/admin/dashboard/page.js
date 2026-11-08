import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { requireWorkspace } from "@/lib/server/auth/permissions";
import { env } from "@/lib/server/env";
import { validWorkDate } from "@/lib/shared/assignment-date";
import { FEATURES } from "@/lib/shared/permissions";
import { durationLabel } from "@/features/attendance/policy";
import { ABSENCE_LABELS } from "@/features/absences/labels";
import { attendanceCounts, dashboardData } from "@/features/dashboard/queries";
import AnalyticsCards from "@/features/dashboard/AnalyticsCards";

export default async function Page({ searchParams }) {
  const { user, permissions } = await requireWorkspace();
  if (!permissions.history?.read)
    return (
      <>
        <div className="page-heading">
          <h1>Selamat datang, {user.name}.</h1>
        </div>
        <div className="dashboard-links">
          {Object.entries(FEATURES)
            .filter(([key]) => permissions[key]?.read)
            .map(([key, label]) => (
              <Link className="dashboard-link" href={`/${key}`} key={key}>
                <h2>{label}</h2>
              </Link>
            ))}
        </div>
      </>
    );
  const params = await searchParams;
  const today = formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd");
  const date = validWorkDate(params?.date) ? params.date : today;
  const {
    options,
    selected,
    groups,
    totals,
    trend,
    roleOptions,
    selectedRole,
  } = await dashboardData(date, params?.project, params?.role);
  const formatTime = (value, zone) =>
    value ? formatInTimeZone(value, zone || env.APP_TIMEZONE, "HH:mm") : "—";
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Dashboard Kehadiran</h1>
          <p>Pantau kehadiran pengguna berdasarkan role dan project.</p>
        </div>
      </div>
      <form className="content-card assignment-filter" method="get">
        <label>
          Role
          <select name="role" defaultValue={selectedRole}>
            <option value="">Semua Role</option>
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tanggal kerja
          <input type="date" name="date" defaultValue={date} required />
        </label>
        <label>
          Project
          <select name="project" defaultValue={selected}>
            <option value="">Semua Project</option>
            {options.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <button className="admin-button" type="submit">
          Terapkan
        </button>
        <Link className="admin-button secondary" href="/admin/dashboard">
          Hari Ini
        </Link>
      </form>
      <AnalyticsCards totals={totals} trend={trend} date={date} />
      <section className="content-card attendance-analytics-projects">
        <h2>Kehadiran per Project</h2>
        <p className="muted">
          Sudah Masuk mencakup pengguna yang sudah pulang dan tidak ditolak.
          Total pengguna dihitung unik. Terlambat adalah rincian dari Sudah
          Masuk.
        </p>
        {groups.length ? (
          <>
            <div
              className="analytics-project-row analytics-project-head"
              aria-hidden="true"
            >
              {[
                "Project",
                "Total Pengguna",
                "Masuk",
                "Belum Absen",
                "Izin",
                "Sakit",
                "Tanpa Keterangan",
                "Terlambat",
                "Pulang",
                "Aksi",
              ].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            {groups.map((group) => {
              const stats = attendanceCounts(group.team);
              return (
                <details className="analytics-project" key={group.id}>
                  <summary className="analytics-project-row">
                    <strong>{group.name}</strong>
                    {[
                      ["Total Pengguna", stats.total],
                      ["Masuk", stats.entered],
                      ["Belum Absen", stats.pending],
                      ["Izin", stats.leave],
                      ["Sakit", stats.sick],
                      ["Tanpa Keterangan", stats.unexcused],
                      ["Terlambat", stats.late],
                      ["Pulang", stats.out],
                    ].map(([label, value]) => (
                      <span key={label}>
                        <span className="analytics-mobile-label">{label}</span>
                        <span className="sr-only analytics-desktop-label">
                          {label}:{" "}
                        </span>
                        {value}
                      </span>
                    ))}
                    <span className="analytics-detail-label">Detail</span>
                  </summary>
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label={`Detail ${group.name}`}
                  >
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Pengguna</th>
                          <th>Jam Masuk</th>
                          <th>Jam Pulang</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.team.map((row) => (
                          <tr key={row.id}>
                            <td>{row.worker}</td>
                            <td>{formatTime(row.checkIn, row.timezone)}</td>
                            <td>{formatTime(row.checkOut, row.timezone)}</td>
                            <td>
                              {row.approvalStatus === "rejected"
                                ? "Ditolak"
                                : row.checkOut
                                  ? "Sudah pulang"
                                  : row.checkIn
                                    ? "Sudah masuk"
                                    : row.absenceStatus
                                      ? ABSENCE_LABELS[row.absenceStatus]
                                      : "Belum absen"}
                              {row.late > 0 && (
                                <small className="block attendance-late">
                                  Terlambat {durationLabel(row.late)}
                                </small>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </>
        ) : (
          <div className="empty-state">
            <p>Belum ada data pengguna untuk filter ini.</p>
          </div>
        )}
      </section>
    </>
  );
}
