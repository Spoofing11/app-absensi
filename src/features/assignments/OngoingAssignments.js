"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveOngoingAssignment,
  deactivateAssignment,
  reactivateAssignment,
} from "./actions";
import { useTimedNotice } from "@/components/ui/useTimedNotice";
export default function OngoingAssignments({
  rows,
  users,
  projects,
  permissions,
}) {
  const router = useRouter();
  const dialog = useRef(null);
  const [role, setRole] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useTimedNotice();
  const [chosen, setChosen] = useState([]);
  const [project, setProject] = useState("");
  const roleOptions = [
    ...new Map(
      users.map((u) => [u.roleId || u.role, u.roleName || u.role]),
    ).entries(),
  ];
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const result = await saveOngoingAssignment(form);
      if (result?.error) {
        setError(result.error);
        return;
      }
      dialog.current.close();
      setNotice(result.success);
      router.refresh();
    } catch {
      setError("Penempatan belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }
  async function deactivate(id, active) {
    if (
      !window.confirm(
        active
          ? "Nonaktifkan penempatan ini? Riwayat absensi tetap tersimpan."
          : "Aktifkan kembali penempatan mulai sekarang? Riwayat lama tetap tersimpan.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("id", id);
      if (active) await deactivateAssignment(form);
      else await reactivateAssignment(form);
      setNotice(
        active ? "Penempatan dinonaktifkan." : "Penempatan diaktifkan.",
      );
      router.refresh();
    } catch {
      setError(
        "Status belum dapat diubah. Pastikan project/pengguna aktif dan belum ada penempatan aktif yang sama.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-card ongoing-placements">
      <div className="section-icon-heading">
        <h2>Penempatan Tanpa Batas Tanggal</h2>
        {permissions.create && (
          <button
            type="button"
            className="admin-button"
            onClick={() => {
              setChosen([]);
              setProject("");
              setQuery("");
              setRole("");
              setError("");
              dialog.current.showModal();
            }}
          >
            Tambah Penempatan
          </button>
        )}
      </div>
      <p className="muted">
        Berlaku sampai dinonaktifkan. Satu pengguna boleh memiliki beberapa
        project aktif. Untuk tukang, gunakan penempatan harian di bawah jika
        bekerja berdasarkan tanggal.
      </p>
      {notice && (
        <p role="status" className="success-notice">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="error-notice">
          {error}
        </p>
      )}
      <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
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
                <td>{row.worker}</td>
                <td>{row.roleName || row.role}</td>
                <td>{row.project}</td>
                <td>{row.isActive ? "Aktif" : "Nonaktif"}</td>
                <td>
                  {permissions.edit && (
                    <button
                      type="button"
                      className="admin-button secondary"
                      disabled={busy}
                      onClick={() => deactivate(row.id, row.isActive)}
                    >
                      {row.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5}>Belum ada penempatan tanpa batas tanggal.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <dialog
        ref={dialog}
        className="admin-dialog"
        aria-labelledby="ongoing-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <div className="dialog-heading">
          <h2 id="ongoing-title">Tambah Penempatan Project</h2>
        </div>
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="assignment-fieldset">
            <div className="dialog-body form-grid">
              <label>
                Project
                <select
                  name="projectId"
                  required
                  value={project}
                  onChange={(e) => {
                    setProject(e.target.value);
                    setChosen([]);
                  }}
                >
                  <option value="">Pilih project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Role
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="">Semua role</option>
                  {roleOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="assignment-worker-field">
                <label>
                  Cari pengguna
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nama pengguna"
                  />
                </label>
                <p>
                  {chosen.length} dipilih. Pilihan tetap tersimpan saat
                  pencarian berubah.
                </p>
                {chosen.map((id) => (
                  <input key={id} type="hidden" name="userId" value={id} />
                ))}
                <div className="assignment-worker-options">
                  {users
                    .filter(
                      (u) =>
                        (!role || (u.roleId || u.role) === role) &&
                        u.name
                          .toLowerCase()
                          .includes(query.trim().toLowerCase()),
                    )
                    .map((u) => {
                      const conflict = rows.some(
                        (r) =>
                          r.workerId === u.id &&
                          r.projectId === project &&
                          r.isActive,
                      );
                      return (
                        <label
                          key={u.id}
                          className={
                            chosen.includes(u.id)
                              ? "is-selected"
                              : conflict
                                ? "unavailable"
                                : ""
                          }
                        >
                          <input
                            type="checkbox"
                            disabled={conflict || !project}
                            checked={chosen.includes(u.id)}
                            onChange={(e) =>
                              setChosen((old) =>
                                e.target.checked
                                  ? [...old, u.id]
                                  : old.filter((id) => id !== u.id),
                              )
                            }
                          />
                          <span>
                            {u.name}
                            <small>{u.roleName || u.role}</small>
                          </span>
                          {conflict
                            ? "Sudah ditempatkan"
                            : chosen.includes(u.id)
                              ? "Dipilih"
                              : ""}
                        </label>
                      );
                    })}
                </div>
              </div>
              {error && (
                <p className="error-notice assignment-form-error" role="alert">
                  {error}
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
                disabled={!chosen.length || chosen.length > 100}
              >
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </fieldset>
        </form>
      </dialog>
    </section>
  );
}
