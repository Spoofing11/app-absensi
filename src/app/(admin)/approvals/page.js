import Link from "next/link";
import {
  requirePermission,
  permissionsFor,
} from "@/lib/server/auth/permissions";
import {
  parseApprovalFilters,
  approvalBounds,
  approvalData,
  approvalHref,
  REVIEW_TABS,
  approvalReadiness,
} from "@/features/approvals/queries";
import ApprovalPanel from "@/features/approvals/ApprovalPanel";
export const metadata = { title: "Approval Absensi" };
export default async function Page({ searchParams }) {
  const actor = await requirePermission("approvals", "read");
  let f;
  try {
    f = parseApprovalFilters(await searchParams);
  } catch {
    return (
      <section className="content-card">
        <h1>Filter tidak valid</h1>
        <p>
          Gunakan tanggal sampai hari ini. Rentang dengan tanggal awal maksimal
          366 hari.
        </p>
        <Link className="admin-button secondary" href="/approvals">
          Reset filter
        </Link>
      </section>
    );
  }
  const { rows, counts, roleOptions, projectOptions, pages, page, total } =
    await approvalData(f);
  const bounds = approvalBounds(f);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Approval Absensi</h1>
          <p>Periksa foto dan catatan sebelum memberi keputusan.</p>
        </div>
      </div>
      <nav className="approval-status-tabs" aria-label="Status approval">
        {REVIEW_TABS.map((tab) => (
          <Link
            key={tab.status}
            href={approvalHref(f, { status: tab.status, page: 1 })}
            aria-current={f.status === tab.status ? "page" : undefined}
          >
            <span>{tab.label}</span>
            <strong>{counts[tab.status]}</strong>
          </Link>
        ))}
      </nav>
      <p className="muted approval-scope-note">
        {f.dateMode === "custom"
          ? "Jumlah tab dan tabel mengikuti rentang tanggal, role, project, dan pengguna yang sama."
          : "Default: Menunggu mencakup seluruh antrean sampai hari ini; Disetujui dan Ditolak mencakup tanggal absensi hari ini."}
      </p>
      <form
        key={`${f.status}:${f.dateMode}:${bounds.from}:${bounds.to}:${f.role}:${f.project}:${f.q}`}
        className="content-card form-grid approval-filters"
        method="get"
      >
        <input type="hidden" name="status" value={f.status} />
        <input type="hidden" name="dateMode" value="custom" />
        <label>
          Dari tanggal
          <input
            type="date"
            name="from"
            defaultValue={bounds.from}
            max={f.today}
          />
          <small>Kosongkan untuk semua tanggal sampai batas akhir.</small>
        </label>
        <label>
          Sampai tanggal
          <input
            type="date"
            name="to"
            defaultValue={bounds.to}
            max={f.today}
            required
          />
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
          Pengguna
          <input
            name="q"
            defaultValue={f.q}
            maxLength={100}
            placeholder="Nama, username, atau kode"
          />
        </label>
        <div className="approval-filter-actions">
          <button className="admin-button">Terapkan</button>
          <Link
            className="admin-button secondary"
            href={approvalHref({
              ...f,
              dateMode: "default",
              role: "",
              project: "",
              q: "",
              page: 1,
            })}
          >
            Reset
          </Link>
        </div>
      </form>
      <ApprovalPanel
        today={f.today}
        canReview={!!(await permissionsFor(actor)).approvals?.edit}
        rows={rows.map((row) => ({
          id: row.id,
          workDate: row.workDate,
          name: row.fullNameSnapshot,
          roleName: row.roleNameSnapshot,
          project: row.projectNameSnapshot,
          checkIn: row.checkInAt?.toISOString(),
          checkOut: row.checkOutAt?.toISOString(),
          timezone: row.timezoneSnapshot,
          hasInPhoto: !!row.checkInPhotoId,
          hasOutPhoto: !!row.checkOutPhotoId,
          lateSeconds: row.lateSeconds,
          approvalStatus: row.approvalStatus,
          readiness: approvalReadiness(row, f.today),
          approvalReason: row.approvalReason,
          reviewedByName: row.reviewedByName,
          reviewedAt: row.reviewedAt?.toISOString(),
          workType: row.workType,
          reportedProject: row.reportedProjectName,
          workNote: row.workNote,
        }))}
      />
      <div className="pagination">
        {page > 1 && (
          <Link href={approvalHref(f, { page: page - 1 })}>Sebelumnya</Link>
        )}
        <span>
          {total} catatan · Halaman {page} / {pages}
        </span>
        {page < pages && (
          <Link href={approvalHref(f, { page: page + 1 })}>Berikutnya</Link>
        )}
        <Link href={approvalHref(f, { status: "legacy", page: 1 })}>
          Data sebelumnya{f.status === "legacy" ? ` (${counts.legacy})` : ""}
        </Link>
      </div>
    </>
  );
}
