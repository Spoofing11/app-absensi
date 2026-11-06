"use client";
import { useTimedNotice } from "@/components/ui/useTimedNotice";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Camera,
  MapPin,
  CheckCircle2,
  LogIn,
  LogOut,
  X,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { EARLY_REASONS, durationLabel } from "../policy";
import { attendanceContext, recordAttendance } from "../actions";
export default function AttendancePanel({ initialContext }) {
  const [workType, setWorkType] = useState("");
  const [workProject, setWorkProject] = useState("");
  const [workNote, setWorkNote] = useState("");
  const [reasonCategory, setReasonCategory] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [clock, setClock] = useState(() =>
    Date.parse(initialContext.serverNow),
  );
  const receivedAt = useRef(0);
  const serverTime = useRef(Date.parse(initialContext.serverNow));
  const [context, setContext] = useState(initialContext);
  const [error, setError] = useState("");
  const [notice, setNotice] = useTimedNotice();
  const [mode, setMode] = useState("in");
  const [photo, setPhoto] = useState("");
  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [opening, setOpening] = useState(false);
  const [pending, setPending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const dialog = useRef(null);
  const video = useRef(null);
  const stream = useRef(null);
  const request = useRef(0);
  const saving = useRef(false);
  const mounted = useRef(true);
  const stopCamera = useCallback(() => {
    request.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);
  useEffect(() => {
    mounted.current = true;
    receivedAt.current = Date.now();
    serverTime.current = Date.parse(initialContext.serverNow);
    let active = true;
    const clockTimer = setInterval(
      () => setClock(serverTime.current + Date.now() - receivedAt.current),
      1000,
    );
    const timer = setInterval(() => {
      attendanceContext()
        .then((result) => {
          if (active) {
            receivedAt.current = Date.now();
            serverTime.current = Date.parse(result.serverNow);
            setContext(result);
            setStale(false);
          }
        })
        .catch(() => {
          if (active) {
            setStale(true);
            setError(
              "Data kehadiran belum dapat diperbarui. Silakan coba lagi.",
            );
          }
        });
    }, 60000);
    return () => {
      active = false;
      mounted.current = false;
      clearInterval(clockTimer);
      clearInterval(timer);
      stopCamera();
    };
  }, [stopCamera, initialContext.serverNow]);
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const result = await attendanceContext();
      if (mounted.current) {
        receivedAt.current = Date.now();
        serverTime.current = Date.parse(result.serverNow);
        setContext(result);
        setStale(false);
        setError("");
      }
    } catch {
      if (mounted.current) {
        setStale(true);
        setError(
          "Gagal memperbarui kehadiran. Periksa koneksi lalu coba lagi.",
        );
      }
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }
  async function startCamera() {
    stopCamera();
    const token = request.current;
    setPhoto("");
    setReady(false);
    setCameraError("");
    setOpening(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      if (token !== request.current || !dialog.current?.open) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
    } catch (err) {
      if (token === request.current)
        setCameraError(
          err.name === "NotAllowedError"
            ? "Akses kamera ditolak. Izinkan kamera melalui pengaturan browser, lalu coba lagi."
            : err.name === "NotFoundError"
              ? "Kamera tidak ditemukan pada perangkat ini."
              : "Kamera belum dapat dibuka. Periksa izin kamera dan pastikan perangkat mendukung akses kamera.",
        );
    } finally {
      if (token === request.current) setOpening(false);
    }
  }
  function open(kind) {
    setWorkType("");
    setWorkProject("");
    setWorkNote("");
    setReasonCategory("");
    setReasonText("");
    setMode(kind);
    setCameraError("");
    setPhoto("");
    dialog.current.showModal();
    startCamera();
  }
  function close() {
    if (saving.current) return;
    stopCamera();
    dialog.current.close();
    setPhoto("");
    setReady(false);
  }
  function capture() {
    try {
      const source = video.current;
      if (!source?.videoWidth || source.readyState < 2)
        throw new Error(
          "Kamera belum siap. Tunggu sebentar lalu coba kembali.",
        );
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1280 / source.videoWidth);
      canvas.width = Math.round(source.videoWidth * scale);
      canvas.height = Math.round(source.videoHeight * scale);
      canvas
        .getContext("2d")
        .drawImage(source, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.75);
      if (data.length > 900000)
        throw new Error("Foto terlalu besar. Silakan ambil ulang.");
      setPhoto(data);
      stopCamera();
    } catch (err) {
      setCameraError(err.message);
    }
  }
  async function save() {
    if (saving.current || !photo) return;
    saving.current = true;
    setPending(true);
    setCameraError("");
    try {
      const result = await recordAttendance(
        mode,
        photo.split(",")[1],
        {
          category: reasonCategory,
          text: reasonText,
        },
        { type: workType, projectId: workProject, note: workNote },
      );
      if (result.error) {
        setCameraError(result.error);
        return;
      }
      stopCamera();
      dialog.current.close();
      setPhoto("");
      setNotice(
        mode === "in"
          ? "Absen masuk berhasil dicatat."
          : "Absen pulang berhasil dicatat.",
      );
      setStale(true);
      try {
        const updated = await attendanceContext();
        if (mounted.current) {
          receivedAt.current = Date.now();
          serverTime.current = Date.parse(updated.serverNow);
          setContext(updated);
          setStale(false);
          setError("");
        }
      } catch {
        if (mounted.current)
          setError(
            "Absensi tersimpan, tetapi ringkasan belum diperbarui. Klik Perbarui.",
          );
      }
    } catch {
      setCameraError(
        "Absensi belum dapat dikonfirmasi. Perbarui ringkasan sebelum mencoba kembali.",
      );
      setStale(true);
    } finally {
      saving.current = false;
      if (mounted.current) setPending(false);
    }
  }
  const record = context.attendance;
  const earlyNow = record?.scheduledEndAt
    ? Math.max(0, Math.ceil((Date.parse(record.scheduledEndAt) - clock) / 1000))
    : 0;
  const needsWork = mode === "out" && context.requiresWorkNote;
  const invalidWork =
    needsWork &&
    (!workType || (workType === "project" ? !workProject : !workNote.trim()));
  const needsReason = mode === "out" && earlyNow > 0;
  const checkedIn = !!record?.check_in_time;
  const finished = !!record?.check_out_time;
  const kind = checkedIn ? "out" : "in";
  const blocked = !checkedIn ? context.blockedReason : "";
  const time = (value) =>
    value
      ? new Intl.DateTimeFormat("id-ID", {
          timeZone: context.timezone,
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(value))
      : "--:--";
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Selamat datang, {context.user.name}.</h1>
        </div>
      </div>
      {record?.lateSeconds > 0 && (
        <Alert
          variant="warning"
          title={`Anda terlambat ${durationLabel(record.lateSeconds)}${record.lateSeconds >= 3600 ? ` (${Math.ceil(record.lateSeconds / 60)} menit)` : ""}.`}
          className="mb-5"
        >
          Dihitung dari jadwal masuk dan waktu check-in yang tercatat.
        </Alert>
      )}
      {record?.earlySeconds > 0 && (
        <Alert variant="info" className="mb-5">
          Anda pulang {durationLabel(record.earlySeconds)} lebih awal. Alasan:{" "}
          {record.earlyReasonCategory}.
        </Alert>
      )}
      {notice && (
        <Alert variant="success" className="mb-5">
          {notice}
        </Alert>
      )}
      {error && (
        <Alert variant="error" className="mb-5">
          {error}
        </Alert>
      )}
      <div
        className={
          context.user.employeeType === "tukang" ? "worker-grid" : undefined
        }
      >
        <section className="content-card attendance-card">
          <div className="attendance-card-heading">
            <div>
              <p className="eyebrow">KEHADIRAN HARI INI</p>
              <h2>Absensi Saya</h2>
            </div>
            <span
              className={`badge ${checkedIn ? "badge-active" : "role-badge"}`}
            >
              <span className="status-dot" />
              {finished
                ? "Selesai bekerja"
                : checkedIn
                  ? "Sedang bekerja"
                  : "Belum check-in"}
            </span>
          </div>
          <div className="attendance-hero-icon">
            {finished ? <CheckCircle2 size={34} /> : <Camera size={34} />}
          </div>
          <h3 className="attendance-title">
            {finished
              ? "Terima kasih atas kerja Anda hari ini."
              : checkedIn
                ? "Jangan lupa absen sebelum pulang."
                : "Siap memulai hari kerja?"}
          </h3>
          <p className="attendance-description">
            {finished
              ? "Absen masuk dan pulang hari ini sudah tercatat."
              : "Gunakan kamera perangkat untuk mengambil foto kehadiran."}
          </p>
          <div className="attendance-times">
            <div>
              <span>
                <LogIn size={15} />
                Absen masuk
              </span>
              <strong>{time(record?.check_in_time)}</strong>
              <small>{checkedIn ? "Sudah tercatat" : "Belum tercatat"}</small>
            </div>
            <div>
              <span>
                <LogOut size={15} />
                Absen pulang
              </span>
              <strong>{time(record?.check_out_time)}</strong>
              <small>{finished ? "Sudah tercatat" : "Belum tercatat"}</small>
            </div>
          </div>
          {blocked && <Alert className="mb-4">{blocked}</Alert>}
          {!finished && (
            <Button
              className="w-full"
              disabled={!!blocked || stale || pending || refreshing}
              onClick={() => open(kind)}
            >
              <Camera size={18} />
              {checkedIn ? "Absen Pulang" : "Absen Masuk"}
            </Button>
          )}
          <button
            className="worker-refresh"
            onClick={refresh}
            disabled={refreshing || pending}
          >
            <RefreshCw size={14} />
            {refreshing ? "Memperbarui..." : "Perbarui ringkasan"}
          </button>
        </section>
        {context.user.employeeType === "tukang" && (
          <div className="worker-aside">
            <section className="content-card">
              <div className="section-icon-heading">
                <MapPin size={18} />
                <h2>Project Aktif</h2>
              </div>
              {context.project ? (
                <>
                  <p className="project-name">{context.project.name}</p>
                  <p className="worker-help">{context.project.address}</p>
                </>
              ) : (
                <p className="worker-help">
                  Belum ada penempatan project aktif. Hubungi Admin sebelum
                  melakukan absen masuk.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
      <dialog
        ref={dialog}
        className="admin-dialog camera-dialog"
        onClose={() => {
          stopCamera();
          setPhoto("");
          setReady(false);
        }}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <div className="dialog-heading">
          <div>
            <h2>{mode === "in" ? "Absen Masuk" : "Absen Pulang"}</h2>
            <p>
              {photo
                ? "Periksa foto sebelum menyimpan absensi."
                : "Posisikan wajah Anda di tengah kamera."}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Tutup kamera"
            disabled={pending}
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <div className="dialog-body">
          <div className="camera-frame">
            {photo ? (
              <Image
                src={photo}
                alt="Preview foto absensi Anda"
                width={1280}
                height={960}
                unoptimized
                className="camera-preview"
              />
            ) : (
              <>
                <video
                  ref={video}
                  autoPlay
                  muted
                  playsInline
                  onLoadedData={() => setReady(true)}
                />
                {!ready && (
                  <div className="camera-placeholder">
                    <Camera size={32} />
                    <span>
                      {opening ? "Membuka kamera..." : "Kamera belum tersedia"}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          {needsWork && (
            <div className="early-reason-form">
              <label>
                Jenis pekerjaan
                <select
                  value={workType}
                  disabled={pending}
                  onChange={(event) => {
                    setWorkType(event.target.value);
                    setWorkProject("");
                    setWorkNote("");
                  }}
                >
                  <option value="">Pilih jenis pekerjaan</option>
                  <option value="project">Project</option>
                  <option value="operational">Operasional</option>
                </select>
              </label>
              {workType === "project" && (
                <label>
                  Project
                  <select
                    value={workProject}
                    disabled={pending}
                    onChange={(event) => setWorkProject(event.target.value)}
                  >
                    <option value="">Pilih project</option>
                    {context.workProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {workType === "operational" && (
                <label>
                  Keterangan operasional
                  <textarea
                    value={workNote}
                    disabled={pending}
                    maxLength={2000}
                    rows={3}
                    onChange={(event) => setWorkNote(event.target.value)}
                    placeholder="Tuliskan pekerjaan atau project yang Anda tangani hari ini"
                  />
                </label>
              )}
            </div>
          )}
          {needsReason && (
            <div className="early-reason-form">
              <Alert variant="warning">
                Anda akan pulang sekitar {durationLabel(earlyNow)} lebih awal.
                Alasan wajib diisi sebelum menyimpan.
              </Alert>
              <label>
                Alasan pulang lebih awal
                <select
                  value={reasonCategory}
                  onChange={(event) => setReasonCategory(event.target.value)}
                  required
                >
                  <option value="">Pilih alasan</option>
                  {EARLY_REASONS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Keterangan
                <textarea
                  value={reasonText}
                  onChange={(event) => setReasonText(event.target.value)}
                  minLength={5}
                  maxLength={1000}
                  required
                  rows={3}
                  placeholder="Jelaskan alasan Anda (minimal 5 karakter)"
                />
              </label>
            </div>
          )}
          {cameraError && <Alert variant="error">{cameraError}</Alert>}
        </div>
        <div className="dialog-footer">
          {photo ? (
            <>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={startCamera}
              >
                Ambil Ulang
              </Button>
              <Button
                loading={pending}
                disabled={
                  stale ||
                  invalidWork ||
                  (needsReason &&
                    (!reasonCategory || reasonText.trim().length < 5))
                }
                onClick={save}
              >
                Simpan Absensi
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                disabled={opening}
                onClick={startCamera}
              >
                Coba Kamera Lagi
              </Button>
              <Button disabled={!ready || opening} onClick={capture}>
                <Camera size={17} />
                Ambil Foto
              </Button>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
