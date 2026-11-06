"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { X } from "lucide-react";
import { absenceOptions, deleteAbsence, saveAbsence } from "./actions";
import { ABSENCE_LABELS } from "./labels";
import { useTimedNotice } from "@/components/ui/useTimedNotice";

export default function AbsencePanel({ rows, date, permissions = {} }) {
  const router = useRouter();
  const dialog = useRef(null);
  const removeDialog = useRef(null);
  const [editing, setEditing] = useState(null);
  const [target, setTarget] = useState(null);
  const [version, setVersion] = useState(0);
  const [workDate, setWorkDate] = useState(date);
  const [type, setType] = useState("");
  const [project, setProject] = useState("");
  const [person, setPerson] = useState("");
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [optionError, setOptionError] = useState("");
  const [notice, setNotice] = useTimedNotice();
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (version === 0) return;
    let active = true;
    setLoading(true);
    setOptionError("");
    absenceOptions(workDate)
      .then((result) => {
        if (!active) return;
        if (result.error) {
          setOptions(null);
          setOptionError(result.error);
        } else setOptions(result);
      })
      .catch(() => {
        if (active) {
          setOptions(null);
          setOptionError(
            "Pilihan pengguna belum dapat dimuat. Tutup lalu buka kembali form.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workDate, version]);

  function open(row = null) {
    flushSync(() => {
      setEditing(row);
      setWorkDate(row?.workDate || date);
      setType(row?.employeeType || "");
      setProject(row?.projectId || "");
      setPerson(row?.userId || "");
      setVersion((value) => value + 1);
      setOptions(null);
      setLoading(true);
      setError("");
    });
    dialog.current.showModal();
  }
  async function submit(event) {
    event.preventDefault();
    if (busy || loading) return;
    setBusy(true);
    setError("");
    try {
      const result = await saveAbsence(new FormData(event.currentTarget));
      if (result.error) {
        setError(result.error);
        return;
      }
      dialog.current.close();
      setNotice("Catatan ketidakhadiran tersimpan.");
      router.refresh();
    } catch {
      setError("Catatan belum dapat disimpan. Periksa koneksi dan coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await deleteAbsence(target.id);
      removeDialog.current.close();
      setNotice("Catatan ketidakhadiran dihapus.");
      router.refresh();
    } catch {
      setError(
        "Catatan sudah berubah atau belum dapat dihapus. Muat ulang dan coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  }
  const assignments = options?.assignments || [];
  const projects = [
    ...new Map(assignments.map((row) => [row.projectId, row.projectName])),
  ];
  const people = (options?.workers || []).filter(
    (row) =>
      row.employeeType === type &&
      (type !== "tukang" ||
        assignments.some(
          (item) => item.userId === row.id && item.projectId === project,
        )),
  );
  return (
    <>
      <div className="absence-toolbar">
        <label>
          Cari pengguna
          <input
            type="search"
            placeholder="Nama atau project"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {permissions.create && (
          <button className="admin-button" onClick={() => open()}>
            Tambah Ketidakhadiran
          </button>
        )}
      </div>
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      <section className="data-panel">
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Daftar ketidakhadiran"
        >
          <table className="admin-table">
            <thead>
              <tr>
                {[
                  "Pengguna",
                  "Jenis",
                  "Tanggal",
                  "Project",
                  "Status",
                  "Catatan",
                  "Aksi",
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((row) =>
                  `${row.name} ${row.projectName || ""}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>
                      {row.employeeType === "tukang" ? "Tukang" : "Karyawan"}
                    </td>
                    <td>{row.workDate}</td>
                    <td>{row.projectName || "—"}</td>
                    <td>
                      <span className="badge role-badge">
                        {ABSENCE_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="project-address">{row.note || "—"}</td>
                    <td>
                      <div className="flex gap-2">
                        {permissions.edit && (
                          <button
                            className="row-action"
                            onClick={() => open(row)}
                          >
                            Ubah
                          </button>
                        )}
                        {permissions.delete && (
                          <button
                            className="row-action"
                            onClick={() => {
                              setTarget(row);
                              setError("");
                              removeDialog.current.showModal();
                            }}
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="empty-state">Belum ada catatan pada tanggal ini.</p>
          )}
        </div>
      </section>
      <dialog
        ref={dialog}
        className="admin-dialog"
        aria-labelledby="absence-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <div className="dialog-heading">
          <div>
            <h2 id="absence-title">
              {editing ? "Ubah" : "Tambah"} Ketidakhadiran
            </h2>
            <p>Satu catatan per pengguna per tanggal.</p>
          </div>
          <button
            className="icon-button"
            disabled={busy}
            onClick={() => dialog.current.close()}
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>
        <form key={version} onSubmit={submit}>
          <input type="hidden" name="id" value={editing?.id || ""} />
          <fieldset disabled={busy} className="assignment-fieldset">
            <div className="dialog-body form-grid">
              <label>
                Tanggal
                <input
                  type="date"
                  name="workDate"
                  required
                  value={workDate}
                  onChange={(event) => {
                    setWorkDate(event.target.value);
                    setProject("");
                    setPerson("");
                    setOptions(null);
                    setLoading(true);
                  }}
                />
              </label>
              <label>
                Jenis pekerja
                <select
                  name="employeeType"
                  value={type}
                  required
                  onChange={(event) => {
                    setType(event.target.value);
                    setProject("");
                    setPerson("");
                  }}
                >
                  <option value="">Pilih jenis pekerja</option>
                  <option value="karyawan">Karyawan</option>
                  <option value="tukang">Tukang</option>
                </select>
              </label>
              {type === "tukang" ? (
                <label className="full-width">
                  Project
                  <select
                    name="projectId"
                    value={project}
                    required
                    disabled={loading}
                    onChange={(event) => {
                      setProject(event.target.value);
                      setPerson("");
                    }}
                  >
                    <option value="">Pilih project</option>
                    {projects.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="projectId" value="" />
              )}
              <label className="full-width">
                Pengguna
                <select
                  name="userId"
                  required
                  value={person}
                  disabled={loading || !type || (type === "tukang" && !project)}
                  onChange={(event) => setPerson(event.target.value)}
                >
                  <option value="">
                    {loading ? "Memuat pilihan…" : "Pilih pengguna"}
                  </option>
                  {people.map((row) => {
                    const present = options?.present.includes(row.id);
                    const duplicate = options?.absent.some(
                      (item) =>
                        item.userId === row.id && item.id !== editing?.id,
                    );
                    return (
                      <option
                        key={row.id}
                        value={row.id}
                        disabled={present || duplicate}
                      >
                        {row.name}
                        {present
                          ? " · Sudah hadir"
                          : duplicate
                            ? " · Sudah tercatat"
                            : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              {!loading && type && !people.length && (
                <p className="muted full-width">
                  Tidak ada pengguna yang sesuai dengan tanggal dan pilihan ini.
                </p>
              )}
              <label className="full-width">
                Status
                <select
                  name="status"
                  required
                  defaultValue={editing?.status || ""}
                >
                  <option value="">Pilih status</option>
                  {Object.entries(ABSENCE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full-width">
                Catatan (opsional)
                <textarea
                  name="note"
                  rows={3}
                  maxLength={2000}
                  defaultValue={editing?.note || ""}
                />
              </label>
              {(error || optionError) && (
                <p className="error-notice full-width" role="alert">
                  {error || optionError}
                </p>
              )}
            </div>
            <div className="dialog-footer">
              <button
                type="button"
                className="admin-button secondary"
                onClick={() => dialog.current.close()}
              >
                Batal
              </button>
              <button
                className="admin-button"
                disabled={busy || loading || !person || !!optionError}
              >
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </fieldset>
        </form>
      </dialog>
      <dialog
        ref={removeDialog}
        className="admin-dialog confirm-dialog"
        aria-labelledby="absence-delete"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <div className="dialog-body">
          <h2 id="absence-delete">Hapus catatan?</h2>
          <p>
            {target?.name} · {target?.workDate} ·{" "}
            {ABSENCE_LABELS[target?.status]}
          </p>
          <p>
            Setelah dihapus, pengguna dapat melakukan absen masuk jika memenuhi
            jadwal dan penempatan.
          </p>
          {error && (
            <p className="error-notice" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="dialog-footer">
          <button
            className="admin-button secondary"
            disabled={busy}
            onClick={() => removeDialog.current.close()}
          >
            Batal
          </button>
          <button
            className="admin-button danger"
            disabled={busy}
            onClick={remove}
          >
            Hapus
          </button>
        </div>
      </dialog>
    </>
  );
}
