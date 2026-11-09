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
  const [selectedPlacement, setSelectedPlacement] = useState("");
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
  const [mirrored, setMirrored] = useState(true);
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
  useEffect(() => {
    if (mode !== "out" || !dialog.current?.open) return;
    setWorkProject(context.defaultWorkProject?.id || "");
    if (!context.defaultWorkProject) setWorkType("operational");
  }, [mode, context.defaultWorkProject?.id]);
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
      const facingMode = media.getVideoTracks()[0]?.getSettings?.().facingMode;
      setMirrored(facingMode !== "environment");
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
    setSelectedPlacement(
      context.placements?.length === 1 ? context.placements[0].id : "",
    );
    setWorkType(
      kind === "out"
        ? context.defaultWorkProject
          ? "project"
          : "operational"
        : "",
    );
    setWorkProject(kind === "out" ? context.defaultWorkProject?.id || "" : "");
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
      const frame = source.getBoundingClientRect();
      const aspect = frame.width / frame.height;
      const sourceAspect = source.videoWidth / source.videoHeight;
      const cropWidth =
        sourceAspect > aspect ? source.videoHeight * aspect : source.videoWidth;
      const cropHeight =
        sourceAspect > aspect ? source.videoHeight : source.videoWidth / aspect;
      const scale = Math.min(1, 1280 / Math.max(cropWidth, cropHeight));
      canvas.width = Math.round(cropWidth * scale);
      canvas.height = Math.round(cropHeight * scale);
      const drawing = canvas.getContext("2d");
      if (!drawing)
        throw new Error("Foto belum dapat diproses. Coba ambil ulang.");
      if (mirrored) {
        drawing.translate(canvas.width, 0);
        drawing.scale(-1, 1);
      }
      drawing.drawImage(
        source,
        (source.videoWidth - cropWidth) / 2,
        (source.videoHeight - cropHeight) / 2,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
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
        {
          type: workType,
          projectId: workProject,
          note: workNote,
          assignmentId: selectedPlacement,
        },
      );
      if (result.error) {
        setCameraError(result.error);
        if (mode === "out") {
          try {
            const latest = await attendanceContext();
            if (mounted.current) {
              receivedAt.current = Date.now();
              serverTime.current = Date.parse(latest.serverNow);
              setContext(latest);
              setStale(false);
            }
          } catch {
            setStale(true);
          }
        }
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
    (!context.defaultWorkProject
      ? !workNote.trim()
      : !workType ||
        (workType === "project" ? !workProject : !workNote.trim()));
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
          variant="error"
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
          context.placements?.length > 0 ||
          context.user.employeeType === "tukang"
            ? "worker-grid"
            : undefined
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
          {record?.approvalStatus && record.approvalStatus !== "legacy" && (
            <p
              className={
                record.approvalStatus === "rejected"
                  ? "attendance-late"
                  : "worker-help"
              }
            >
              Approval:{" "}
              {record.approvalStatus === "approved"
                ? "Disetujui"
                : record.approvalStatus === "rejected"
                  ? `Ditolak — ${record.approvalReason || ""}`
                  : "Menunggu pemeriksaan"}
            </p>
          )}
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
        {(context.placements?.length > 0 ||
          context.user.employeeType === "tukang") && (
          <div className="worker-aside">
            <section className="content-card">
              <div className="section-icon-heading">
                <MapPin size={18} />
                <h2>Anda Ditempatkan di Project</h2>
              </div>
              {record && context.project && (
                <p className="worker-help">
                  Project saat absen masuk: {context.project.name}
                </p>
              )}
              {context.placements?.length ? (
                context.placements.map((p) => (
                  <div key={p.id} className="placement-summary">
                    <span className="badge badge-active">Project Aktif</span>
                    <p className="project-name">{p.name}</p>
                    <p className="worker-help">{p.address}</p>
                  </div>
                ))
              ) : (
                <p className="worker-help">
                  Belum ada penempatan project aktif.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
      <dialog
        ref={dialog}
        className={`admin-dialog camera-dialog${photo ? " has-photo" : ""}`}
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
          {mode === "in" && context.placements?.length > 1 && (
            <label className="camera-project-choice">
              Project penempatan
              <select
                value={selectedPlacement}
                disabled={pending}
                onChange={(e) => setSelectedPlacement(e.target.value)}
              >
                <option value="">Pilih project untuk absen masuk</option>
                {context.placements.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
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
                  data-mirrored={mirrored}
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
          {needsWork && photo && (
            <div className="early-reason-form">
              {context.defaultWorkProject ? (
                <label>
                  Jenis pekerjaan
                  <select
                    value={workType}
                    disabled={pending}
                    onChange={(event) => {
                      setWorkType(event.target.value);
                      setWorkProject(
                        event.target.value === "project"
                          ? context.defaultWorkProject.id
                          : "",
                      );
                      setWorkNote("");
                    }}
                  >
                    <option value="project">Sesuai project penempatan</option>
                    <option value="operational">
                      Operasional / Project lain
                    </option>
                  </select>
                </label>
              ) : (
                <p className="worker-help">
                  <strong>Operasional</strong>
                  <br />
                  Isi keterangan pekerjaan hari ini sebelum menyimpan absen
                  pulang.
                </p>
              )}
              {workType === "project" && context.defaultWorkProject && (
                <div className="worker-help">
                  <strong>{context.defaultWorkProject.name}</strong>
                  <p>
                    Mengikuti project saat absen masuk. Jika mengerjakan project
                    lain, pilih Operasional dan isi keterangan.
                  </p>
                </div>
              )}
              {(!context.defaultWorkProject || workType === "operational") && (
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
          {needsReason && photo && (
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
                  (mode === "in" &&
                    context.placements?.length > 1 &&
                    !selectedPlacement) ||
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
