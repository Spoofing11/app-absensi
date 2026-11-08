"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { reviewAttendance } from "./actions";
import { APPROVAL_LABELS } from "@/lib/shared/attendance-review";
import { useTimedNotice } from "@/components/ui/useTimedNotice";
function Photo({ id, kind, available }) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      src={
        available && !failed
          ? `/api/attendance-photo/${id}/${kind}`
          : "/images/no-photo.svg"
      }
      alt={kind === "in" ? "Foto masuk" : "Foto pulang"}
      width={320}
      height={320}
      unoptimized
      onError={() => setFailed(true)}
      style={{ width: "100%", height: 240, objectFit: "contain" }}
    />
  );
}
export default function ApprovalPanel({ rows, canReview, today }) {
  const modal = useRef(null);
  const router = useRouter();
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useTimedNotice();
  const time = (value, zone) =>
    value
      ? new Intl.DateTimeFormat("id-ID", {
          timeZone: zone,
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(value))
      : "Belum tercatat";
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const result = await reviewAttendance(form);
      if (result.error) {
        setError(result.error);
        return;
      }
      modal.current.close();
      setNotice(result.success);
      router.refresh();
    } catch {
      setError("Keputusan belum dapat disimpan. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {notice && (
        <p role="status" className="success-notice">
          {notice}
        </p>
      )}
      <section className="content-card">
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Pengguna</th>
                <th>Role</th>
                <th>Project</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.workDate}</td>
                  <td>{row.name}</td>
                  <td>{row.roleName || "—"}</td>
                  <td>{row.project || "—"}</td>
                  <td>{APPROVAL_LABELS[row.approvalStatus]}</td>
                  <td>
                    <button
                      className="admin-button secondary"
                      type="button"
                      onClick={() => {
                        setSelected(row);
                        setDecision("");
                        setReason("");
                        setError("");
                        modal.current.showModal();
                      }}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6}>Tidak ada catatan sesuai filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <dialog
        ref={modal}
        className="admin-dialog approval-dialog"
        aria-labelledby="review-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        {selected && (
          <form onSubmit={submit}>
            <div className="dialog-body">
              <h2 id="review-title">Review Absensi</h2>
              <p>
                {selected.name} · {selected.workDate}
              </p>
              <p className="muted">
                {selected.project || "Tanpa project"} · {selected.roleName}
              </p>
              <div className="approval-photo-grid">
                <div>
                  <h3>Absen Masuk</h3>
                  <Photo
                    key={`${selected.id}-in`}
                    id={selected.id}
                    kind="in"
                    available={selected.hasInPhoto}
                  />
                  <p
                    className={
                      selected.lateSeconds > 0 ? "attendance-late" : ""
                    }
                  >
                    {time(selected.checkIn, selected.timezone)}
                  </p>
                  {selected.lateSeconds > 0 && (
                    <small className="attendance-late">
                      Terlambat {Math.ceil(selected.lateSeconds / 60)} menit
                    </small>
                  )}
                </div>
                <div>
                  <h3>Absen Pulang</h3>
                  <Photo
                    key={`${selected.id}-out`}
                    id={selected.id}
                    kind="out"
                    available={selected.hasOutPhoto}
                  />
                  <p>{time(selected.checkOut, selected.timezone)}</p>
                  {!selected.checkOut && (
                    <small>
                      {selected.workDate < today
                        ? "Tidak absen pulang"
                        : "Menunggu absen pulang"}
                    </small>
                  )}
                </div>
              </div>
              <p>Status: {APPROVAL_LABELS[selected.approvalStatus]}</p>
              {selected.workType && (
                <p>
                  Laporan pekerjaan:{" "}
                  {selected.workType === "operational"
                    ? "Operasional"
                    : selected.reportedProject || "Project"}{" "}
                  {selected.workNote && `· ${selected.workNote}`}
                </p>
              )}
              {selected.approvalReason && (
                <p>Alasan: {selected.approvalReason}</p>
              )}
              {selected.reviewedByName && (
                <p className="muted">
                  Diproses oleh {selected.reviewedByName} ·{" "}
                  {selected.reviewedAt
                    ? new Date(selected.reviewedAt).toLocaleString("id-ID", {
                        timeZone: selected.timezone,
                      })
                    : ""}
                </p>
              )}
              <input type="hidden" name="id" value={selected.id} />
              <input type="hidden" name="status" value={decision} />
              {decision === "rejected" && (
                <label>
                  Alasan penolakan
                  <textarea
                    name="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    maxLength={2000}
                    rows={3}
                  />
                </label>
              )}
              {error && (
                <p role="alert" className="error-notice">
                  {error}
                </p>
              )}
              {selected.approvalStatus === "pending" &&
                !selected.checkOut &&
                selected.workDate >= today && (
                  <p className="muted">
                    Review tersedia setelah absen pulang atau pergantian hari.
                  </p>
                )}
            </div>
            <div className="dialog-footer">
              <button
                type="button"
                className="admin-button secondary"
                disabled={busy}
                onClick={() => modal.current.close()}
              >
                Tutup
              </button>
              {canReview &&
                selected.approvalStatus === "pending" &&
                (selected.checkOut || selected.workDate < today) && (
                  <>
                    <button
                      type="button"
                      className="admin-button secondary"
                      disabled={busy}
                      onClick={() => setDecision("rejected")}
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      className="admin-button"
                      disabled={busy}
                      onClick={() => setDecision("approved")}
                    >
                      Setujui
                    </button>
                    {decision && (
                      <button
                        type="submit"
                        className="admin-button"
                        disabled={
                          busy || (decision === "rejected" && !reason.trim())
                        }
                      >
                        {busy
                          ? "Menyimpan…"
                          : decision === "approved"
                            ? "Konfirmasi Persetujuan"
                            : "Konfirmasi Penolakan"}
                      </button>
                    )}
                  </>
                )}
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
