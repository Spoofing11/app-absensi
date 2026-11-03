"use client";
import { useTimedNotice } from "@/components/ui/useTimedNotice";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { FEATURES, OPERATIONS } from "@/lib/shared/permissions";
import { saveRole, deleteRole } from "@/features/roles/actions";
import { saveSchedule, deleteSchedule } from "@/features/schedules/actions";
import { saveProject, deleteProject } from "@/features/projects/actions";
export default function EntityManager({
  kind,
  rows,
  permissions,
  schedules = [],
}) {
  const role = kind === "roles";
  const schedule = kind === "schedules";
  const entityLabel = role ? "Role" : schedule ? "Jadwal Kerja" : "Project";
  const title = `Manajemen ${entityLabel}`;
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useTimedNotice();
  const dialog = useRef(null);
  const confirmation = useRef(null);
  const [target, setTarget] = useState(null);
  const router = useRouter();
  function open(row) {
    flushSync(() => {
      setEditing(row);
      setError("");
    });
    dialog.current.showModal();
  }
  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = event.currentTarget;
    try {
      await (role ? saveRole : schedule ? saveSchedule : saveProject)(
        new FormData(form),
      );
      form.reset();
      dialog.current.close();
      setNotice("Data berhasil disimpan.");
      router.refresh();
    } catch {
      setError(
        "Tidak dapat menyimpan. Pastikan nama unik, isian valid, dan Anda memiliki hak akses.",
      );
    } finally {
      setPending(false);
    }
  }
  async function remove() {
    setPending(true);
    setError("");
    try {
      const data = new FormData();
      data.set("id", target.id);
      await (role ? deleteRole : schedule ? deleteSchedule : deleteProject)(
        data,
      );
      confirmation.current.close();
      setNotice("Data berhasil dihapus.");
      router.refresh();
    } catch {
      setError(
        "Data tidak dapat dihapus. Data masih digunakan atau Anda tidak memiliki hak akses.",
      );
    } finally {
      setPending(false);
    }
  }
  const filtered = rows.filter((r) =>
    `${r.name} ${r.address || ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            ADMINISTRASI /{" "}
            {role ? "HAK AKSES" : schedule ? "JADWAL KERJA" : "PROJECT"}
          </p>
          <h1>{title}</h1>
          <p>
            {role
              ? "Atur izin Create, Read, Edit, dan Delete untuk setiap fitur."
              : schedule
                ? "Atur jam masuk, jam pulang, dan status jadwal kerja."
                : "Kelola project yang digunakan dalam penempatan tukang."}
          </p>
        </div>
        {permissions.create && (
          <button className="admin-button" onClick={() => open(null)}>
            <Plus size={18} />
            Tambah {entityLabel}
          </button>
        )}
      </div>
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      <section className="data-panel">
        <div className="panel-heading">
          <h2>
            Daftar {entityLabel}{" "}
            <span className="count-pill">{rows.length}</span>
          </h2>
        </div>
        <div className="table-toolbar">
          <input
            aria-label="Cari data"
            placeholder="Cari nama..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div
          className="table-scroll"
          role="region"
          aria-label={title}
          tabIndex={0}
        >
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>{role ? "Jenis" : schedule ? "Jam Kerja" : "Alamat"}</th>
                <th>{schedule ? "Status" : "Jadwal"}</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                  </td>
                  <td>
                    {role ? (
                      <span className="badge role-badge">
                        {row.isSystem
                          ? "Admin utama / dilindungi"
                          : "Role kustom"}
                      </span>
                    ) : schedule ? (
                      <span>
                        {row.startTime.slice(0, 5)} - {row.endTime.slice(0, 5)}
                      </span>
                    ) : (
                      <span className="project-address">{row.address}</span>
                    )}
                  </td>
                  <td>
                    {schedule ? (
                      <span
                        className={`badge ${row.isActive ? "badge-active" : "badge-inactive"}`}
                      >
                        {row.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    ) : row.isSystem ? (
                      "Tanpa absensi"
                    ) : (
                      schedules.find((item) => item.id === row.workScheduleId)
                        ?.name || (role ? "Belum diatur" : "Ikuti Role Tukang")
                    )}
                  </td>
                  <td>
                    <div className="flex gap-2 justify-end">
                      {!row.isSystem && permissions.edit && (
                        <button
                          className="row-action"
                          onClick={() => open(row)}
                        >
                          Edit
                        </button>
                      )}
                      {!row.isSystem && permissions.delete && (
                        <button
                          className="row-action"
                          onClick={() => {
                            setTarget(row);
                            setError("");
                            confirmation.current.showModal();
                          }}
                        >
                          Hapus
                        </button>
                      )}
                      {row.isSystem && (
                        <span className="muted">Dilindungi</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty-state">Belum ada data yang sesuai.</div>
          )}
        </div>
        <div className="table-footer">
          Menampilkan {filtered.length} dari {rows.length} data
        </div>
      </section>
      <dialog
        ref={dialog}
        className="admin-dialog"
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <div className="dialog-heading">
          <h2>
            {editing ? "Edit" : "Tambah"} {entityLabel}
          </h2>
          <button
            className="icon-button"
            disabled={pending}
            aria-label="Tutup"
            onClick={() => dialog.current.close()}
          >
            <X size={20} />
          </button>
        </div>
        <form key={editing?.id || "new"} onSubmit={submit}>
          <div className="dialog-body form-grid">
            <input type="hidden" name="id" value={editing?.id || ""} />
            <label className="full-width">
              Nama {role ? "role" : schedule ? "jadwal" : "project"}
              <input
                name="name"
                required
                maxLength={role || schedule ? 100 : 150}
                defaultValue={editing?.name || ""}
              />
            </label>
            {!schedule && (
              <label className="full-width">
                {role ? "Jadwal default" : "Jadwal project"}
                <select
                  name="workScheduleId"
                  defaultValue={editing?.workScheduleId || ""}
                >
                  <option value="">
                    {role ? "Belum ditentukan" : "Ikuti jadwal Role Tukang"}
                  </option>
                  {schedules.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.isActive ? "" : " (Nonaktif)"} ·{" "}
                      {item.startTime.slice(0, 5)}–{item.endTime.slice(0, 5)}
                    </option>
                  ))}
                </select>
                <small>
                  {role
                    ? "Karyawan mengikuti jadwal ini. Tukang memakai jadwal ini bila project tidak memiliki jadwal."
                    : "Berlaku untuk Tukang yang ditempatkan di project ini."}
                </small>
              </label>
            )}
            {schedule ? (
              <>
                <label>
                  Jam masuk
                  <input
                    name="startTime"
                    type="time"
                    required
                    defaultValue={editing?.startTime?.slice(0, 5) || ""}
                  />
                </label>
                <label>
                  Jam pulang
                  <input
                    name="endTime"
                    type="time"
                    required
                    defaultValue={editing?.endTime?.slice(0, 5) || ""}
                  />
                </label>
                <label className="full-width">
                  <span>
                    <input
                      name="isActive"
                      type="checkbox"
                      defaultChecked={editing ? editing.isActive : true}
                      style={{
                        width: 18,
                        minHeight: 18,
                        verticalAlign: "middle",
                        marginRight: 8,
                      }}
                    />
                    Jadwal aktif
                  </span>
                  <small>
                    Jam pulang lebih awal dari jam masuk berarti pulang pada
                    hari berikutnya.
                  </small>
                </label>
              </>
            ) : !role ? (
              <label className="full-width">
                Alamat
                <textarea
                  aria-label="Alamat"
                  name="address"
                  required
                  maxLength={5000}
                  rows={3}
                  defaultValue={editing?.address || ""}
                />
              </label>
            ) : (
              <div className="full-width">
                <p className="muted mb-3 text-xs">
                  Read diperlukan untuk membuka fitur. Absensi hanya untuk
                  pekerja, bukan Admin utama.
                </p>
                <div className="table-scroll">
                  <table className="admin-table permission-table">
                    <thead>
                      <tr>
                        <th>Fitur</th>
                        {OPERATIONS.map((op) => (
                          <th key={op}>{op}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(FEATURES).map(([feature, label]) => (
                        <tr key={feature}>
                          <td>{label}</td>
                          {OPERATIONS.map((op) => (
                            <td key={op}>
                              <input
                                type="checkbox"
                                name={`${feature}.${op}`}
                                disabled={
                                  feature === "history" && op !== "read"
                                }
                                title={
                                  feature === "history" && op !== "read"
                                    ? "Riwayat hanya mendukung Read"
                                    : undefined
                                }
                                aria-label={`${label} ${op}`}
                                defaultChecked={
                                  editing?.permissions?.[feature]?.[op] || false
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {error && (
              <p className="error-notice full-width" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="dialog-footer">
            <button
              className="admin-button secondary"
              type="button"
              disabled={pending}
              onClick={() => dialog.current.close()}
            >
              Batal
            </button>
            <button className="admin-button" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={confirmation}
        className="admin-dialog confirm-dialog"
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <div className="dialog-body">
          <h2>Hapus {target?.name}?</h2>
          <p>
            Data yang masih digunakan tidak dapat dihapus. Tindakan ini tidak
            dapat dibatalkan.
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
            disabled={pending}
            onClick={() => confirmation.current.close()}
          >
            Batal
          </button>
          <button
            className="admin-button danger"
            disabled={pending}
            onClick={remove}
          >
            {pending ? "Memproses..." : "Hapus"}
          </button>
        </div>
      </dialog>
    </>
  );
}
