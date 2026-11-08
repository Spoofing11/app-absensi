import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { requireUser } from "@/lib/server/auth/session";
import { db } from "@/lib/server/db";
import { activityLogs } from "@/lib/server/db/schema";
import { env } from "@/lib/server/env";
import { validWorkDate } from "@/lib/shared/assignment-date";
import { isSystemAdministrator } from "@/features/activity-logs/server";

export const metadata = { title: "Log Aktivitas" };

const features = {
  auth: "Sesi",
  history: "Riwayat Absensi",
  attendance: "Absensi",
  absences: "Ketidakhadiran",
  profile: "Profil",
  users: "User",
  roles: "Role",
  schedules: "Jadwal Kerja",
  projects: "Project",
  assignments: "Penempatan",
  approvals: "Approval Absensi",
  "photo-recap": "Rekap Foto Absensi",
};
const actions = {
  login: "Login",
  export: "Ekspor",
  approve: "Setujui",
  reject: "Tolak",
  logout: "Logout",
  check_in: "Absen Masuk",
  check_out: "Absen Pulang",
  create: "Tambah",
  edit: "Ubah",
  delete: "Hapus",
  deactivate: "Nonaktifkan",
  password: "Ubah Password",
};
const pageSize = 25;

function nextDay(date) {
  const value = new Date(date + "T00:00:00Z");
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export default async function ActivityLogsPage({ searchParams }) {
  const user = await requireUser();
  if (!(await isSystemAdministrator(user))) redirect("/access-denied");

  const params = await searchParams;
  const query =
    typeof params?.q === "string" ? params.q.trim().slice(0, 150) : "";
  const feature =
    typeof params?.feature === "string" &&
    Object.hasOwn(features, params.feature)
      ? params.feature
      : "";
  const action =
    typeof params?.action === "string" && Object.hasOwn(actions, params.action)
      ? params.action
      : "";
  const from = validWorkDate(params?.from) ? params.from : "";
  const to = validWorkDate(params?.to) ? params.to : "";
  const invalidRange = from && to && from > to;
  const zone = env.APP_TIMEZONE;
  const conditions = [];
  if (query)
    conditions.push(
      sql`(LOCATE(LOWER(${query}), LOWER(${activityLogs.actorName})) > 0 OR LOCATE(LOWER(${query}), LOWER(${activityLogs.actorUsername})) > 0)`,
    );
  if (feature) conditions.push(eq(activityLogs.feature, feature));
  if (action) conditions.push(eq(activityLogs.action, action));
  if (from)
    conditions.push(
      gte(activityLogs.createdAt, fromZonedTime(from + "T00:00:00", zone)),
    );
  if (to)
    conditions.push(
      lt(
        activityLogs.createdAt,
        fromZonedTime(nextDay(to) + "T00:00:00", zone),
      ),
    );

  const where = and(...conditions);
  const [{ total }] = invalidRange
    ? [{ total: 0 }]
    : await db.select({ total: count() }).from(activityLogs).where(where);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const requested =
    typeof params?.page === "string" && /^[0-9]+$/.test(params.page)
      ? Number(params.page)
      : 1;
  const page = Math.min(pages, Math.max(1, requested));
  const rows = invalidRange
    ? []
    : await db
        .select()
        .from(activityLogs)
        .where(where)
        .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

  function pageHref(value) {
    const filters = new URLSearchParams();
    for (const [key, entry] of Object.entries({
      q: query,
      feature,
      action,
      from,
      to,
    })) {
      if (entry) filters.set(key, entry);
    }
    filters.set("page", String(value));
    return "/activity-logs?" + filters.toString();
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Log Aktivitas</h1>
          <p>Lihat aktivitas pengguna yang dicatat oleh sistem.</p>
        </div>
      </div>
      <form
        className="content-card assignment-filter"
        method="get"
        action="/activity-logs"
      >
        <label>
          Pengguna
          <input
            name="q"
            type="search"
            defaultValue={query}
            maxLength={150}
            placeholder="Nama atau username"
          />
        </label>
        <label>
          Dari tanggal
          <input name="from" type="date" defaultValue={from} />
        </label>
        <label>
          Sampai tanggal
          <input name="to" type="date" defaultValue={to} />
        </label>
        <label>
          Fitur
          <select name="feature" defaultValue={feature}>
            <option value="">Semua fitur</option>
            {Object.entries(features).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Aksi
          <select name="action" defaultValue={action}>
            <option value="">Semua aksi</option>
            {Object.entries(actions).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="admin-button" type="submit">
          Terapkan
        </button>
        <Link className="admin-button secondary" href="/activity-logs">
          Reset Filter
        </Link>
      </form>
      {invalidRange && (
        <p className="error-notice" role="alert">
          Tanggal akhir harus sama atau setelah tanggal awal.
        </p>
      )}
      <section className="content-card">
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Tabel log aktivitas"
        >
          <table className="admin-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pengguna</th>
                <th>Aksi</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {formatInTimeZone(
                      row.createdAt,
                      zone,
                      "dd/MM/yyyy HH:mm:ss",
                    )}
                  </td>
                  <td>
                    <strong>{row.actorName}</strong>
                    <small className="block muted">@{row.actorUsername}</small>
                  </td>
                  <td>
                    {actions[row.action] || row.action}
                    <small className="block muted">
                      {features[row.feature] || row.feature}
                    </small>
                  </td>
                  <td className="project-address">{row.detail}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={4}>
                    {invalidRange
                      ? "Perbaiki rentang tanggal."
                      : "Belum ada aktivitas yang cocok."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <nav
            className="assignment-pagination"
            aria-label="Halaman log aktivitas"
          >
            {page > 1 && (
              <Link
                className="admin-button secondary"
                href={pageHref(page - 1)}
              >
                Sebelumnya
              </Link>
            )}
            <span>
              Halaman {page} dari {pages} · {total} aktivitas
            </span>
            {page < pages && (
              <Link
                className="admin-button secondary"
                href={pageHref(page + 1)}
              >
                Berikutnya
              </Link>
            )}
          </nav>
        )}
      </section>
    </>
  );
}
