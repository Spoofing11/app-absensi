import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/server/db";
import { absences } from "@/lib/server/db/schema";
import { env } from "@/lib/server/env";
import {
  requirePermission,
  permissionsFor,
} from "@/lib/server/auth/permissions";
import { validWorkDate } from "@/lib/shared/assignment-date";
import AbsencePanel from "@/features/absences/AbsencePanel";
import { ABSENCE_LABELS } from "@/features/absences/labels";
export const metadata = { title: "Ketidakhadiran" };
export default async function Page({ searchParams }) {
  const actor = await requirePermission("absences");
  const params = await searchParams;
  const date = validWorkDate(params?.date)
    ? params.date
    : formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd");
  const status =
    typeof params?.status === "string" &&
    Object.hasOwn(ABSENCE_LABELS, params.status)
      ? params.status
      : "";
  const where = and(
    eq(absences.workDate, date),
    status ? eq(absences.status, status) : undefined,
  );
  const rows = await db
    .select({
      id: absences.id,
      userId: absences.userId,
      name: absences.name,
      workDate: absences.workDate,
      employeeType: absences.employeeType,
      projectId: absences.projectId,
      projectName: absences.projectName,
      status: absences.status,
      note: absences.note,
    })
    .from(absences)
    .where(where)
    .orderBy(absences.name, desc(absences.createdAt));
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Ketidakhadiran</h1>
          <p>
            Catat sakit, izin, atau tanpa keterangan untuk karyawan dan tukang.
          </p>
        </div>
      </div>
      <form className="content-card assignment-filter" action="/absences">
        <label>
          Tanggal
          <input name="date" type="date" defaultValue={date} required />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status}>
            <option value="">Semua status</option>
            {Object.entries(ABSENCE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="admin-button">Terapkan</button>
        <Link className="admin-button secondary" href="/absences">
          Hari Ini
        </Link>
      </form>
      <AbsencePanel
        rows={rows}
        date={date}
        permissions={(await permissionsFor(actor)).absences}
      />
    </>
  );
}
