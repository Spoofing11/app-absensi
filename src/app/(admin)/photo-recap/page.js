import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { requirePermission } from "@/lib/server/auth/permissions";
import { photoRecapData } from "@/features/photo-recap/queries";
import RecapPhoto from "@/features/photo-recap/RecapPhoto";
import { APPROVAL_LABELS } from "@/lib/shared/attendance-review";
import { ABSENCE_LABELS } from "@/features/absences/labels";
import { env } from "@/lib/server/env";
export const metadata = { title: "Rekap Foto Absensi" };
export default async function Page({ searchParams }) {
  await requirePermission("photo-recap", "read");
  let data;
  try {
    data = await photoRecapData(await searchParams);
  } catch {
    return (
      <section className="content-card">
        <p>
          Filter tidak valid atau data terlalu banyak. Gunakan rentang maksimal
          366 hari dan persempit role/project.
        </p>
        <Link href="/photo-recap">Reset filter</Link>
      </section>
    );
  }
  const { filters: f, weeks, roleOptions, projectOptions } = data;
  const today = formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd");
  const users = [
    ...new Map(
      data.records.map((r) => [r.userId, r.fullNameSnapshot]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "id"));
  const pages = Math.max(1, Math.ceil(users.length / 20));
  const page = Math.min(f.page, pages);
  const selectedUsers = new Set(
    users.slice((page - 1) * 20, page * 20).map(([id]) => id),
  );
  const query = new URLSearchParams({
    from: f.from,
    to: f.to,
    role: f.role,
    project: f.project,
    q: f.q,
  });
  const time = (value, zone) =>
    value ? formatInTimeZone(value, zone, "HH:mm") : "—";
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Rekap Foto Absensi</h1>
          <p>Senin–Minggu. Catatan ditolak tidak masuk total kehadiran.</p>
        </div>
        <a className="admin-button" href={`/api/photo-recap-export?${query}`}>
          Ekspor PDF
        </a>
      </div>
      <form className="content-card form-grid" method="get">
        <label>
          Dari tanggal
          <input type="date" name="from" defaultValue={f.from} required />
        </label>
        <label>
          Sampai tanggal
          <input type="date" name="to" defaultValue={f.to} required />
        </label>
        <label>
          Role
          <select name="role" defaultValue={f.role}>
            <option value="">Semua Role</option>
            {roleOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Project
          <select name="project" defaultValue={f.project}>
            <option value="">Semua Project</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cari pengguna
          <input
            name="q"
            defaultValue={f.q}
            maxLength={100}
            placeholder="Nama atau kode pengguna"
          />
        </label>
        <button className="admin-button">Terapkan</button>
      </form>
      <p className="muted">
        PDF mengikuti filter yang sudah diterapkan dan mencakup semua halaman.
        Maksimal 1000 catatan per ekspor; persempit filter untuk laporan besar.
      </p>
      {weeks.map((week, weekIndex) => {
        const rows = week.users.filter((u) => selectedUsers.has(u.userId));
        if (!rows.length) return null;
        return (
          <details
            className="content-card photo-week photo-week-collapsible"
            key={week.start}
            open
          >
            <summary>
              <strong>
                Minggu ke-{weekIndex + 1} · {week.start} – {week.dates[6]}
              </strong>
              <span>{rows.length} pengguna pada halaman ini</span>
            </summary>
            <p className="muted recap-scroll-hint">
              Geser tabel ke samping untuk melihat setiap hari. Nama dan total
              kehadiran tetap terlihat.
            </p>
            <div
              className="table-scroll photo-recap-scroll"
              tabIndex={0}
              role="region"
              aria-label={`Rekap minggu ${week.start}`}
            >
              <table className="admin-table photo-recap-table">
                <colgroup>
                  <col className="recap-name-column" />
                  {week.dates.map((date) => (
                    <col key={date} className="recap-day-column" />
                  ))}
                  <col className="recap-total-column" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="recap-person">
                      Nama Pengguna
                    </th>
                    {week.dates.map((date) => (
                      <th key={date}>
                        {new Date(date + "T00:00:00Z").toLocaleDateString(
                          "id-ID",
                          { timeZone: "UTC", weekday: "long" },
                        )}
                        <br />
                        {date}
                      </th>
                    ))}
                    <th scope="col" className="recap-total">
                      Total
                      <br />
                      Kehadiran
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((person) => (
                    <tr key={person.userId}>
                      <td className="recap-person">
                        <strong>{person.name}</strong>
                        <small className="block muted">{person.code}</small>
                      </td>
                      {week.dates.map((date) => {
                        if (date < f.from || date > f.to)
                          return (
                            <td key={date} className="recap-outside">
                              Di luar filter
                            </td>
                          );
                        const row = person.days[date];
                        if (!row) return <td key={date}>Tidak ada catatan</td>;
                        return (
                          <td key={date}>
                            <div className="recap-photo-pair">
                              <div>
                                <RecapPhoto
                                  key={`${row.id}-in`}
                                  id={row.id}
                                  kind="in"
                                  available={!!row.checkInPhotoId}
                                />
                                <small
                                  className={
                                    row.lateSeconds > 0 ? "attendance-late" : ""
                                  }
                                >
                                  Masuk{" "}
                                  {time(row.checkInAt, row.timezoneSnapshot)}
                                </small>
                              </div>
                              <div>
                                <RecapPhoto
                                  key={`${row.id}-out`}
                                  id={row.id}
                                  kind="out"
                                  available={
                                    !!row.checkOutPhotoId &&
                                    row.approvalStatus !== "rejected"
                                  }
                                />
                                <small>
                                  Pulang{" "}
                                  {time(row.checkOutAt, row.timezoneSnapshot)}
                                </small>
                              </div>
                            </div>
                            <small className="block muted">
                              {row.roleNameSnapshot} ·{" "}
                              {row.projectNameSnapshot || "Tanpa Project"}
                            </small>
                            <small
                              className={
                                row.approvalStatus === "rejected"
                                  ? "attendance-late"
                                  : ""
                              }
                            >
                              {row.absenceStatus
                                ? ABSENCE_LABELS[row.absenceStatus]
                                : APPROVAL_LABELS[row.approvalStatus]}
                            </small>
                            {!row.checkOutAt &&
                              row.checkInAt &&
                              date < today && (
                                <small className="block">
                                  Tidak absen pulang
                                </small>
                              )}
                            {row.approvalReason && (
                              <small className="block history-reason">
                                {row.approvalReason}
                              </small>
                            )}
                          </td>
                        );
                      })}
                      <td className="recap-total">
                        <strong>{person.total}</strong>
                        <span className="block">hari</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
      {!data.records.length && (
        <section className="content-card">
          Belum ada data sesuai filter.
        </section>
      )}
      <div className="pagination">
        {page > 1 && (
          <Link href={`/photo-recap?${query}&page=${page - 1}`}>
            Sebelumnya
          </Link>
        )}
        <span>
          Halaman {page} / {pages} · {users.length} pengguna
        </span>
        {page < pages && (
          <Link href={`/photo-recap?${query}&page=${page + 1}`}>
            Berikutnya
          </Link>
        )}
      </div>
    </>
  );
}
