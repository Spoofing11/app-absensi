import { APPROVAL_LABELS } from "@/lib/shared/attendance-review";
import { ABSENCE_LABELS } from "@/features/absences/labels";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { historyDetail } from "@/features/attendance-history/queries";
import { durationLabel } from "@/features/attendance/policy";
export const metadata = { title: "Detail Absensi" };
export default async function Page({ params }) {
  const { id } = await params;
  const row = await historyDetail(id);
  if (!row) notFound();
  const date = (value) =>
    value
      ? new Intl.DateTimeFormat("id-ID", {
          timeZone: row.timezoneSnapshot,
          dateStyle: "medium",
          timeStyle: "short",
        }).format(value)
      : "Belum tercatat";
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">KEHADIRAN / DETAIL</p>
          <h1>{row.fullNameSnapshot}</h1>
          <p>
            {row.userCodeSnapshot} · {row.workDate}
          </p>
        </div>
        <Link className="admin-button secondary" href="/history">
          Kembali ke Riwayat
        </Link>
      </div>
      <section className="content-card history-detail">
        <dl>
          {row.approvalStatus && (
            <>
              <dt>Approval</dt>
              <dd>{APPROVAL_LABELS[row.approvalStatus]}</dd>
              {row.approvalReason && (
                <>
                  <dt>Alasan penolakan</dt>
                  <dd>{row.approvalReason}</dd>
                </>
              )}
            </>
          )}
          {row.reportedProjectName && (
            <>
              <dt>Project laporan pekerjaan</dt>
              <dd>{row.reportedProjectName}</dd>
            </>
          )}
          <dt>Role saat absen</dt>
          <dd>{row.roleNameSnapshot || `Data lama · ${row.roleSnapshot}`}</dd>
          {row.projectNameSnapshot?.trim() && (
            <>
              <dt>Project saat absen</dt>
              <dd>{row.projectNameSnapshot}</dd>
            </>
          )}
          {row.absenceStatus && (
            <>
              <dt>Status</dt>
              <dd>{ABSENCE_LABELS[row.absenceStatus]}</dd>
              {row.note && (
                <>
                  <dt>Catatan</dt>
                  <dd className="history-reason">{row.note}</dd>
                </>
              )}
            </>
          )}
          {row.workType && (
            <>
              <dt>Jenis pekerjaan</dt>
              <dd>
                {row.workType === "operational" ? "Operasional" : "Project"}
              </dd>
            </>
          )}
          {row.workNote && (
            <>
              <dt>Keterangan operasional</dt>
              <dd className="history-reason">{row.workNote}</dd>
            </>
          )}
          {row.scheduleNameSnapshot && (
            <>
              <dt>Jadwal</dt>
              <dd>
                {row.scheduleNameSnapshot} · {row.timezoneSnapshot}
                <br />
                {date(row.scheduledStartAt)} — {date(row.scheduledEndAt)}
              </dd>
            </>
          )}
          {!row.absenceStatus && (
            <>
              <dt>Absen masuk</dt>
              <dd>{date(row.checkInAt)}</dd>
              <dt>Absen pulang</dt>
              <dd>{date(row.checkOutAt)}</dd>
              <dt>Keterlambatan</dt>
              <dd
                className={row.lateSeconds > 0 ? "attendance-late" : undefined}
              >
                {durationLabel(row.lateSeconds)}
              </dd>
              <dt>Durasi kehadiran</dt>
              <dd>
                {row.checkOutAt
                  ? durationLabel((row.checkOutAt - row.checkInAt) / 1000)
                  : "Belum lengkap"}
              </dd>
              {row.earlySeconds > 0 && (
                <>
                  <dt>Pulang lebih awal</dt>
                  <dd>{durationLabel(row.earlySeconds)}</dd>
                </>
              )}
              {row.earlyReasonCategory?.trim() && (
                <>
                  <dt>Alasan</dt>
                  <dd>{row.earlyReasonCategory}</dd>
                </>
              )}
              {row.earlyReasonText?.trim() && (
                <>
                  <dt>Keterangan</dt>
                  <dd className="history-reason">{row.earlyReasonText}</dd>
                </>
              )}
            </>
          )}
        </dl>
        {!row.absenceStatus && (
          <div className="history-photos">
            {[
              ["in", "Foto masuk", row.checkInPhotoId],
              [
                "out",
                "Foto pulang",
                row.approvalStatus === "rejected" ? null : row.checkOutPhotoId,
              ],
            ].map(([kind, label, photo]) => (
              <div key={kind}>
                <h2>{label}</h2>
                {photo ? (
                  <Image
                    src={`/api/attendance-photo/${row.id}/${kind}`}
                    width={640}
                    height={480}
                    unoptimized
                    alt={label}
                    className="history-photo"
                  />
                ) : (
                  <Image
                    src="/images/no-photo.svg"
                    width={320}
                    height={320}
                    alt="No Photo"
                    className="history-photo"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
