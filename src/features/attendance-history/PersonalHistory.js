import Link from "next/link";
import { and, eq, desc, count, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { attendances } from "@/lib/server/db/schema";
import { requireUser } from "@/lib/server/auth/session";
import { durationLabel } from "@/features/attendance/policy";
export default async function PersonalHistory({ searchParams = {} }) {
  const user = await requireUser();
  const params = searchParams || {};
  const parsedPage = z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .safeParse(params.personalPage || 1);
  const from = z.iso.date().safeParse(params.personalFrom);
  const to = z.iso.date().safeParse(params.personalTo);
  const conditions = [eq(attendances.userId, user.id)];
  if (from.success) conditions.push(gte(attendances.workDate, from.data));
  if (to.success) conditions.push(lte(attendances.workDate, to.data));
  const [totalRow] = await db
    .select({ total: count() })
    .from(attendances)
    .where(and(...conditions));
  const pages = Math.max(1, Math.ceil(totalRow.total / 10));
  const page = Math.min(parsedPage.success ? parsedPage.data : 1, pages);
  const rows = await db
    .select({
      id: attendances.id,
      date: attendances.workDate,
      role: attendances.roleNameSnapshot,
      legacyRole: attendances.roleSnapshot,
      checkIn: attendances.checkInAt,
      checkOut: attendances.checkOutAt,
      timezone: attendances.timezoneSnapshot,
      late: attendances.lateSeconds,
      early: attendances.earlySeconds,
      reason: attendances.earlyReasonCategory,
      note: attendances.earlyReasonText,
      project: attendances.projectNameSnapshot,
    })
    .from(attendances)
    .where(and(...conditions))
    .orderBy(
      desc(attendances.workDate),
      desc(attendances.checkInAt),
      desc(attendances.id),
    )
    .limit(10)
    .offset((page - 1) * 10);
  const time = (value, tz) =>
    value
      ? new Intl.DateTimeFormat("id-ID", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
        }).format(value)
      : "Belum tercatat";
  const href = (target) => {
    const query = new URLSearchParams();
    query.set("personalPage", String(target));
    if (from.success) query.set("personalFrom", from.data);
    if (to.success) query.set("personalTo", to.data);
    return `/dashboard?${query}#riwayat-pribadi`;
  };
  return (
    <section id="riwayat-pribadi" className="personal-history">
      <div className="page-heading">
        <div>
          <p className="eyebrow">KEHADIRAN / CATATAN SAYA</p>
          <h2>Riwayat Absensi Saya</h2>
          <p>
            Hanya catatan akun Anda. Role mengikuti data saat absen dicatat.
          </p>
        </div>
      </div>
      <div className="data-panel">
        <form className="personal-history-filter" action="/dashboard">
          <label>
            Dari tanggal
            <input
              name="personalFrom"
              type="date"
              defaultValue={from.success ? from.data : ""}
            />
          </label>
          <label>
            Sampai tanggal
            <input
              name="personalTo"
              type="date"
              defaultValue={to.success ? to.data : ""}
            />
          </label>
          <button className="admin-button">Terapkan</button>
          <Link
            href="/dashboard#riwayat-pribadi"
            className="admin-button secondary"
          >
            Reset
          </Link>
        </form>
        <div
          className="table-scroll"
          role="region"
          aria-label="Riwayat absensi pribadi"
          tabIndex={0}
        >
          <table className="admin-table">
            <thead>
              <tr>
                {[
                  "Tanggal",
                  "Role saat absen",
                  "Masuk",
                  "Pulang",
                  "Status",
                  "Detail",
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.role || `Data lama · ${row.legacyRole}`}</td>
                  <td>{time(row.checkIn, row.timezone)}</td>
                  <td>{time(row.checkOut, row.timezone)}</td>
                  <td>
                    <div className="history-status">
                      <span
                        className={`badge ${row.late > 0 ? "badge-warning" : "badge-active"}`}
                      >
                        {row.late > 0
                          ? `Terlambat ${durationLabel(row.late)}`
                          : "Tepat waktu"}
                      </span>
                      {row.early > 0 && (
                        <span className="badge badge-warning">Pulang awal</span>
                      )}
                      {!row.checkOut && (
                        <span className="badge role-badge">Belum pulang</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <details className="personal-history-details">
                      <summary>Lihat detail</summary>
                      <div>
                        {row.project && <p>Project: {row.project}</p>}
                        {row.early > 0 && (
                          <p>Pulang awal: {durationLabel(row.early)}</p>
                        )}
                        {row.reason && <p>Alasan: {row.reason}</p>}
                        {row.note && (
                          <p className="history-reason">{row.note}</p>
                        )}
                        <p>
                          Durasi kehadiran:{" "}
                          {row.checkOut
                            ? durationLabel((row.checkOut - row.checkIn) / 1000)
                            : "Belum lengkap"}
                        </p>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="empty-state">
              <h3>Belum ada riwayat absensi</h3>
              <p>Catatan absen masuk dan pulang Anda akan tampil di sini.</p>
            </div>
          )}
        </div>
        <div className="history-pagination personal-history-pagination">
          <span>
            {totalRow.total} catatan · Halaman {page} dari {pages}
          </span>
          <div>
            {page > 1 && (
              <Link className="admin-button secondary" href={href(page - 1)}>
                Sebelumnya
              </Link>
            )}
            {page < pages && (
              <Link className="admin-button secondary" href={href(page + 1)}>
                Berikutnya
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
