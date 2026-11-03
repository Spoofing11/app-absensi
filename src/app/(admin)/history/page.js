import Link from "next/link";
import { requirePermission } from "@/lib/server/auth/permissions";
import {
  parseFilters,
  historyData,
} from "@/features/attendance-history/queries";
import { durationLabel } from "@/features/attendance/policy";
export const metadata = { title: "Riwayat Absensi" };
const time = (value, tz) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
      }).format(value)
    : "Belum absen pulang";
export default async function Page({ searchParams }) {
  const params = await searchParams;
  let validated;
  await requirePermission("history", "read");
  try {
    validated = parseFilters(params);
  } catch (error) {
    if (error?.digest) throw error;
    return (
      <section className="content-card">
        <h1>Filter tidak valid</h1>
        <p className="worker-help">
          Gunakan rentang tanggal maksimal 366 hari dan pilihan filter yang
          tersedia.
        </p>
        <Link className="admin-button mt-4" href="/history">
          Atur ulang filter
        </Link>
      </section>
    );
  }
  const data = await historyData(validated);
  const {
    filters: f,
    groups,
    rows,
    total,
    pages,
    roleOptions,
    projectOptions,
  } = data;
  function href(changes) {
    const p = new URLSearchParams({ ...f, ...changes });
    return `/history?${p}`;
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">KEHADIRAN / RIWAYAT</p>
          <h1>Riwayat Absensi</h1>
          <p>
            Kelompok berdasarkan Role saat check-in, bukan Role pengguna saat
            ini.
          </p>
        </div>
      </div>
      <section className="data-panel">
        <form className="history-filters" action="/history">
          <input type="hidden" name="view" value={f.view} />
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
                <option value={r.key} key={r.key}>
                  {r.label}
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
            Status
            <select name="status" defaultValue={f.status}>
              <option value="">Semua status</option>
              <option value="late">Terlambat</option>
              <option value="early">Pulang awal</option>
              <option value="open">Belum absen pulang</option>
              <option value="complete">Lengkap</option>
            </select>
          </label>
          <label>
            Cari pengguna
            <input
              name="q"
              defaultValue={f.q}
              maxLength={100}
              placeholder="Nama atau kode"
            />
          </label>
          <button className="admin-button">Terapkan</button>
          <Link className="admin-button secondary" href="/history">
            Reset
          </Link>
        </form>
        <div className="history-tabs">
          <Link
            aria-current={f.view === "detail" ? "page" : undefined}
            href={href({ view: "detail", page: 1 })}
          >
            Riwayat Detail
          </Link>
          <Link
            aria-current={f.view === "recap" ? "page" : undefined}
            href={href({ view: "recap", page: 1 })}
          >
            Rekap Pengguna
          </Link>
        </div>
      </section>
      <p className="worker-help mb-4">
        Data lama dikelompokkan menggunakan kategori role lama. Role historis
        yang tidak tersimpan tidak ditebak dari akun saat ini. Durasi kehadiran
        bukan perhitungan jam kerja bersih atau lembur.
      </p>
      {!rows.length ? (
        <section className="content-card empty-state">
          <h2>Belum ada data</h2>
          <p>Coba rentang tanggal atau filter lainnya.</p>
        </section>
      ) : (
        groups
          .filter((g) => rows.some((r) => r.groupKey === g.key))
          .map((group) => (
            <details className="data-panel history-group" open key={group.key}>
              <summary>
                <strong>{group.label}</strong>
                <span>
                  {Number(group.users)} pengguna · {Number(group.records)}{" "}
                  catatan dalam filter
                </span>
              </summary>
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label={group.label}
              >
                <table className="admin-table">
                  <thead>
                    <tr>
                      {(f.view === "detail"
                        ? [
                            "Pengguna",
                            "Tanggal",
                            "Project",
                            "Masuk",
                            "Pulang",
                            "Status",
                            "Aksi",
                          ]
                        : [
                            "Pengguna",
                            "Hari hadir",
                            "Hari terlambat",
                            "Total terlambat",
                            "Belum pulang",
                            "Pulang awal",
                            "Durasi kehadiran",
                          ]
                      ).map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      .filter((r) => r.groupKey === group.key)
                      .map((r) => (
                        <tr key={r.id || r.userId}>
                          <td>
                            <strong>{r.name}</strong>
                            <small className="block muted mt-1">{r.code}</small>
                          </td>
                          {f.view === "detail" ? (
                            <>
                              <td>{r.date}</td>
                              <td>{r.project || "—"}</td>
                              <td>{time(r.checkIn, r.timezone)}</td>
                              <td>{time(r.checkOut, r.timezone)}</td>
                              <td>
                                <div className="history-status">
                                  <span
                                    className={`badge ${r.lateSeconds > 0 ? "badge-warning" : "badge-active"}`}
                                  >
                                    {r.lateSeconds > 0
                                      ? `Terlambat ${durationLabel(r.lateSeconds)}`
                                      : "Tepat waktu"}
                                  </span>
                                  {r.earlySeconds > 0 && (
                                    <span className="badge badge-warning">
                                      Pulang awal
                                    </span>
                                  )}
                                  {!r.checkOut && (
                                    <span className="badge role-badge">
                                      Belum pulang
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <Link
                                  className="row-action"
                                  href={`/history/${r.id}`}
                                >
                                  Detail
                                </Link>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{Number(r.days)}</td>
                              <td>{Number(r.lateDays)}</td>
                              <td>{durationLabel(Number(r.lateSeconds))}</td>
                              <td>{Number(r.open)}</td>
                              <td>{Number(r.early)}</td>
                              <td>{durationLabel(Number(r.duration))}</td>
                            </>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))
      )}
      <div className="history-pagination">
        <span>
          {total} {f.view === "detail" ? "catatan" : "baris rekap"} · Halaman{" "}
          {f.page} dari {pages} · 25 per halaman
        </span>
        <div>
          {f.page > 1 && (
            <Link
              className="admin-button secondary"
              href={href({ page: f.page - 1 })}
            >
              Sebelumnya
            </Link>
          )}
          {f.page < pages && (
            <Link
              className="admin-button secondary"
              href={href({ page: f.page + 1 })}
            >
              Berikutnya
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
