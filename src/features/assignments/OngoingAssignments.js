"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveOngoingAssignment,
  deactivateAssignment,
  reactivateAssignment,
  updateOngoingAssignment,
  deleteAssignment,
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
  const [editing, setEditing] = useState(null);
  const [listQuery, setListQuery] = useState("");
  const [listRole, setListRole] = useState("");
  const [listProject, setListProject] = useState("");
  const [listStatus, setListStatus] = useState("");
  const [page, setPage] = useState(1);
  const [role, setRole] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useTimedNotice();
  const [chosen, setChosen] = useState([]);
  const [project, setProject] = useState("");
  const roleOptions = [
    ...new Map(
      [...users, ...rows].map((u) => [
        u.roleId || u.role,
        u.roleName || u.role,
      ]),
    ).entries(),
  ];
  const filtered = rows.filter(
    (row) =>
      (!listRole || (row.roleId || row.role) === listRole) &&
      (!listProject || row.projectId === listProject) &&
      (!listStatus ||
        (listStatus === "active" ? row.isActive : !row.isActive)) &&
      `${row.worker} ${row.project}`
        .toLowerCase()
        .includes(listQuery.trim().toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const filterProjects = [
    ...new Map(
      [
        ...projects,
        ...rows.map((r) => ({ id: r.projectId, name: r.project })),
      ].map((p) => [p.id, p]),
    ).values(),
  ];
  const formProjects =
    editing && !projects.some((p) => p.id === editing.projectId)
      ? [
          ...projects,
          { id: editing.projectId, name: `${editing.project} (nonaktif)` },
        ]
      : projects;
  const formUsers =
    editing && !users.some((u) => u.id === editing.workerId)
      ? [
          ...users,
          {
            id: editing.workerId,
            name: `${editing.worker} (tidak aktif)`,
            roleId: editing.roleId,
            role: editing.role,
            roleName: editing.roleName,
          },
        ]
      : users;
  function open(row = null) {
    setEditing(row);
    setChosen(row ? [row.workerId] : []);
    setProject(row?.projectId || "");
    setQuery("");
    setRole(row?.roleId || row?.role || "");
    setError("");
    dialog.current.showModal();
  }
  async function remove(row) {
    if (
      !window.confirm(
        `Hapus penempatan ${row.worker} di ${row.project}? Absensi tidak dihapus. Absensi hari ini yang belum pulang akan menjadi Operasional dan wajib keterangan.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("id", row.id);
      const result = await deleteAssignment(form);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setNotice("Penempatan berhasil dihapus.");
      router.refresh();
    } catch {
      setError("Penempatan belum dapat dihapus.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      if (editing) form.set("id", editing.id);
      const result = editing
        ? await updateOngoingAssignment(form)
        : await saveOngoingAssignment(form);
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
        <h2>Penempatan Karyawan</h2>
        {permissions.create && (
          <button type="button" className="admin-button" onClick={() => open()}>
            Tambah Penempatan
          </button>
        )}
      </div>
      <p className="muted">
        Berlaku sampai dinonaktifkan. Satu pengguna boleh memiliki beberapa
        project aktif. Gunakan filter untuk mencari pengguna, role, project,
        atau status.
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
      <div className="placement-filters">
        <label>
          Cari pengguna / project
          <input
            type="search"
            value={listQuery}
            onChange={(e) => {
              setListQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Nama pengguna atau project"
          />
        </label>
        <label>
          Role
          <select
            value={listRole}
            onChange={(e) => {
              setListRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua Role</option>
            {roleOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Project
          <select
            value={listProject}
            onChange={(e) => {
              setListProject(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua Project</option>
            {filterProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={listStatus}
            onChange={(e) => {
              setListStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </label>
        <button
          type="button"
          className="admin-button secondary"
          onClick={() => {
            setListQuery("");
            setListRole("");
            setListProject("");
            setListStatus("");
            setPage(1);
          }}
        >
          Reset Filter
        </button>
      </div>
      <div
        className="table-scroll employee-placement-scroll"
        tabIndex={0}
        role="region"
        aria-label="Daftar penempatan karyawan, geser ke samping pada layar kecil"
      >
        <table className="admin-table employee-placement-table">
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "30%" }} />
          </colgroup>
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
            {visible.map((row) => (
              <tr key={row.id}>
                <td>{row.worker}</td>
                <td>{row.roleName || row.role}</td>
                <td>{row.project}</td>
                <td>{row.isActive ? "Aktif" : "Nonaktif"}</td>
                <td>
                  <div className="placement-row-actions">
                    {permissions.edit && (
                      <button
                        type="button"
                        className="admin-button secondary"
                        disabled={busy}
                        title="Edit penempatan"
                        onClick={() => open(row)}
                      >
                        Edit
                      </button>
                    )}
                    {permissions.delete && (
                      <button
                        type="button"
                        className="admin-button secondary"
                        disabled={busy}
                        title="Hapus penempatan tanpa menghapus absensi"
                        onClick={() => remove(row)}
                      >
                        Hapus
                      </button>
                    )}
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
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={5}>Tidak ada penempatan sesuai filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>
          {filtered.length} penempatan · Halaman {currentPage} / {pages}
        </span>
        <button
          type="button"
          className="admin-button secondary"
          disabled={currentPage <= 1}
          onClick={() => setPage(currentPage - 1)}
        >
          Sebelumnya
        </button>
        <button
          type="button"
          className="admin-button secondary"
          disabled={currentPage >= pages}
          onClick={() => setPage(currentPage + 1)}
        >
          Berikutnya
        </button>
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
          <h2 id="ongoing-title">
            {editing ? "Edit Penempatan" : "Tambah Penempatan Karyawan"}
          </h2>
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
                    if (!editing) setChosen([]);
                  }}
                >
                  <option value="">Pilih project</option>
                  {formProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Role
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    if (editing) setChosen([]);
                  }}
                >
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
                  {formUsers
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
                          r.isActive &&
                          r.id !== editing?.id,
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
                            type={editing ? "radio" : "checkbox"}
                            disabled={conflict || !project}
                            checked={chosen.includes(u.id)}
                            onChange={(e) =>
                              setChosen((old) =>
                                editing
                                  ? [u.id]
                                  : e.target.checked
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
