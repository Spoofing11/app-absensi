import Link from "next/link";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/server/db";
import { attendances } from "@/lib/server/db/schema";
import { env } from "@/lib/server/env";
import {
  requirePermission,
  permissionsFor,
} from "@/lib/server/auth/permissions";
import { parseFilters } from "@/features/attendance-history/queries";
import ApprovalPanel from "@/features/approvals/ApprovalPanel";
export const metadata = { title: "Approval Absensi" };
export default async function Page({ searchParams }) {
  const actor = await requirePermission("approvals", "read");
  const params = await searchParams;
  let f;
  try {
    f = parseFilters({ ...params, status: "" });
  } catch {
    return (
      <section className="content-card">
        <p>Pilih rentang tanggal yang valid, maksimal 366 hari.</p>
        <Link href="/approvals">Reset filter</Link>
      </section>
    );
  }
  const status = ["pending", "approved", "rejected", "legacy"].includes(
    params.status,
  )
    ? params.status
    : "pending";
  const where = and(
    gte(attendances.workDate, f.from),
    lte(attendances.workDate, f.to),
    eq(attendances.approvalStatus, status),
    f.q
      ? sql`LOCATE(LOWER(${f.q}), LOWER(${attendances.fullNameSnapshot})) > 0`
      : undefined,
  );
  const [count] = await db
    .select({ total: sql`COUNT(*)` })
    .from(attendances)
    .where(where);
  const pages = Math.max(1, Math.ceil(Number(count.total) / 25));
  const page = Math.min(f.page, pages);
  const rows = await db
    .select()
    .from(attendances)
    .where(where)
    .orderBy(
      desc(attendances.workDate),
      desc(attendances.checkInAt),
      attendances.id,
    )
    .limit(25)
    .offset((page - 1) * 25);
  const href = (page) =>
    `/approvals?${new URLSearchParams({ from: f.from, to: f.to, q: f.q, status, page: String(page) })}`;
  return (
    <>
      <div className="page-heading">
        <h1>Approval Absensi</h1>
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
          Pengguna
          <input name="q" defaultValue={f.q} maxLength={100} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status}>
            <option value="pending">Menunggu</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
            <option value="legacy">Data sebelumnya</option>
          </select>
        </label>
        <button className="admin-button">Terapkan</button>
      </form>
      <ApprovalPanel
        today={formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd")}
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
          approvalReason: row.approvalReason,
          reviewedByName: row.reviewedByName,
          reviewedAt: row.reviewedAt?.toISOString(),
          workType: row.workType,
          reportedProject: row.reportedProjectName,
          workNote: row.workNote,
        }))}
      />
      <div className="pagination">
        {page > 1 && <Link href={href(page - 1)}>Sebelumnya</Link>}
        <span>
          Halaman {page} / {pages}
        </span>
        {page < pages && <Link href={href(page + 1)}>Berikutnya</Link>}
      </div>
    </>
  );
}
