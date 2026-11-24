"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { correctAttendanceTime } from "./actions";

export default function CorrectionDialog({ data }) {
  const dialog = useRef(null);
  const router = useRouter();
  const [values, setValues] = useState(data);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  function open() {
    setValues(data);
    setReason("");
    setConfirm(false);
    setError("");
    setSuccess("");
    dialog.current.showModal();
  }
  async function submit(event) {
    event.preventDefault();
    if (!confirm) {
      setConfirm(true);
      return;
    }
    if (pending) return;
    setPending(true);
    setError("");
    const form = new FormData();
    for (const key of [
      "id",
      "version",
      "revision",
      "checkIn",
      "checkOut",
      "checkoutDate",
    ])
      form.set(key, String(values[key]));
    form.set("reason", reason);
    try {
      const result = await correctAttendanceTime(form);
      if (result.error) setError(result.error);
      else {
        dialog.current.close();
        setSuccess(result.success);
        router.refresh();
      }
    } catch {
      setError("Koreksi belum dapat disimpan. Periksa koneksi dan coba lagi.");
    } finally {
      setPending(false);
    }
  }
  const change = (key) => (event) =>
    setValues({ ...values, [key]: event.target.value });
  return (
    <>
      <button type="button" className="admin-button" onClick={open}>
        Koreksi Waktu
      </button>
      {success && <p role="status">{success}</p>}
      <dialog
        ref={dialog}
        aria-labelledby="attendance-correction-title"
        className="admin-dialog attendance-correction-dialog"
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <form onSubmit={submit}>
          <div className="dialog-heading">
            <h2 id="attendance-correction-title">Koreksi Waktu Absensi</h2>
          </div>
          <div className="dialog-body correction-fields">
            <p>
              Tanggal kerja: <strong>{data.workDate}</strong> · {data.timezone}
            </p>
            <p>
              Foto dan tanggal kerja tetap tersimpan. Alasan koreksi wajib
              diisi.
            </p>
            {data.approvalStatus === "approved" && (
              <p>
                Absensi yang sudah disetujui akan kembali menunggu approval.
              </p>
            )}
            {data.approvalStatus === "rejected" && (
              <p>Status ditolak tetap berlaku setelah koreksi waktu.</p>
            )}
            <label>
              Jam masuk
              <input
                aria-label="Jam masuk"
                type="time"
                step="1"
                required
                value={values.checkIn}
                onChange={change("checkIn")}
                readOnly={confirm}
              />
            </label>
            {data.checkOut ? (
              <>
                <label>
                  Tanggal pulang
                  <input
                    type="date"
                    required
                    min={data.workDate}
                    max={data.maxCheckoutDate}
                    value={values.checkoutDate}
                    onChange={change("checkoutDate")}
                    readOnly={confirm}
                  />
                </label>
                <label>
                  Jam pulang
                  <input
                    type="time"
                    step="1"
                    required
                    value={values.checkOut}
                    onChange={change("checkOut")}
                    readOnly={confirm}
                  />
                </label>
              </>
            ) : (
              <p>
                Absen pulang belum tercatat. Koreksi ini hanya mengubah jam
                masuk.
              </p>
            )}
            <label>
              Alasan koreksi
              <textarea
                required
                minLength={5}
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                readOnly={confirm}
              />
            </label>
            {confirm && (
              <div role="status">
                <strong>Periksa perubahan sebelum menyimpan</strong>
                <p>
                  Masuk: {data.workDate} {data.checkIn} → {data.workDate}{" "}
                  {values.checkIn}
                </p>
                {data.checkOut && (
                  <p>
                    Pulang: {data.checkoutDate} {data.checkOut} →{" "}
                    {values.checkoutDate} {values.checkOut}
                  </p>
                )}
                <p>
                  Keterlambatan, pulang awal, dan durasi akan mengikuti waktu
                  baru.
                </p>
              </div>
            )}
            {error && (
              <p role="alert">
                {error}{" "}
                <button
                  type="button"
                  className="admin-button secondary"
                  disabled={pending}
                  onClick={() => {
                    dialog.current.close();
                    router.refresh();
                  }}
                >
                  Muat Ulang Data
                </button>
              </p>
            )}
          </div>
          <div className="dialog-footer">
            <button
              className="admin-button secondary"
              type="button"
              disabled={pending}
              onClick={() =>
                confirm ? setConfirm(false) : dialog.current.close()
              }
            >
              {confirm ? "Kembali" : "Batal"}
            </button>
            <button className="admin-button" disabled={pending} type="submit">
              {pending
                ? "Menyimpan…"
                : confirm
                  ? "Simpan Koreksi"
                  : "Tinjau Koreksi"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
