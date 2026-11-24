import { APPROVAL_LABELS } from "@/lib/shared/attendance-review";
import { ABSENCE_LABELS } from "@/features/absences/labels";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { historyDetail } from "@/features/attendance-history/queries";
import { durationLabel } from "@/features/attendance/policy";
import { correctionData } from "@/features/attendance-corrections/queries";
import CorrectionDialog from "@/features/attendance-corrections/CorrectionDialog";
export const metadata = { title: "Detail Absensi" };
export default async function Page({ params, searchParams }) {
  const { id } = await params;
  const row = await historyDetail(id);
  if (!row) notFound();
  const corrections = await correctionData(
    row,
    (await searchParams)?.correctionsPage,
  );
  const date = (value) =>
    value
      ? new Intl.DateTimeFormat("id-ID", {
          timeZone: row.timezoneSnapshot,
          dateStyle: "medium",
          timeStyle: "medium",
        }).format(new Date(value))
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
      {corrections && (
        <section
          className="content-card correction-section"
          id="riwayat-koreksi"
        >
          <h2>Koreksi Waktu Absensi</h2>
          <p>
            Khusus Administrator. Setiap perubahan menyimpan waktu sebelumnya,
            alasan, dan pengubahnya.
          </p>
          <CorrectionDialog data={corrections.form} />
          {corrections.original && (
            <p>
              Waktu asli sebelum koreksi pertama: masuk{" "}
              {date(corrections.original.checkInAt)} · pulang{" "}
              {date(corrections.original.checkOutAt)}
            </p>
          )}
          <h3>Riwayat Koreksi</h3>
          {!corrections.rows.length && (
            <p>Belum ada koreksi pada halaman ini.</p>
          )}
          {corrections.rows.map((item) => (
            <article className="correction-entry" key={item.id}>
              <strong>
                Koreksi #{item.revision} · {item.actorName} (@
                {item.actorUsername})
              </strong>
              <p>
                {date(item.createdAt)} · {item.timezone}
              </p>
              <p>
                Masuk: {date(item.beforeState.checkInAt)} →{" "}
                {date(item.afterState.checkInAt)}
              </p>
              <p>
                Pulang: {date(item.beforeState.checkOutAt)} →{" "}
                {date(item.afterState.checkOutAt)}
              </p>
              <p className="history-reason">Alasan: {item.reason}</p>
            </article>
          ))}
          <nav aria-label="Halaman riwayat koreksi">
            {corrections.page > 1 && (
              <Link
                className="admin-button secondary"
                href={`/history/${id}?correctionsPage=${corrections.page - 1}#riwayat-koreksi`}
              >
                Sebelumnya
              </Link>
            )}
            {corrections.hasNext && (
              <Link
                className="admin-button secondary"
                href={`/history/${id}?correctionsPage=${corrections.page + 1}#riwayat-koreksi`}
              >
                Berikutnya
              </Link>
            )}
          </nav>
        </section>
      )}
    </>
  );
}
