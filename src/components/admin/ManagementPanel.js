"use client";
import { useTimedNotice } from "@/components/ui/useTimedNotice";
import PasswordRules from "@/components/ui/PasswordRules";
import { passwordError } from "@/lib/shared/password";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Plus, X, Users, ArrowUpRight, Inbox } from "lucide-react";
import { saveUser, deactivateUser } from "@/features/users/actions";

export default function ManagementPanel({
  rows,
  currentUserId,
  roles = [],
  permissions = {},
}) {
  const [attendanceEnabled, setAttendanceEnabled] = useState(true);
  const [employeeType, setEmployeeType] = useState("karyawan");
  const [passwordInput, setPasswordInput] = useState("");
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useTimedNotice();
  const modal = useRef(null);
  const confirmModal = useRef(null);
  const [target, setTarget] = useState(null);
  const router = useRouter();
  function openModal(row) {
    flushSync(() => {
      setEditing(row);
      setPasswordInput("");
      setAttendanceEnabled(row ? !!row.attendanceEnabled : true);
      setEmployeeType(row?.employeeType === "tukang" ? "tukang" : "karyawan");
      setError("");
    });
    modal.current.showModal();
  }
  const filtered = rows.filter(
    (row) =>
      `${row.name} ${row.username}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!filter || row.roleId === filter),
  );
  async function submit(event) {
    event.preventDefault();
    if (passwordInput || !editing) {
      const message = passwordError(passwordInput);
      if (message) {
        setError(message);
        return;
      }
    }
    setPending(true);
    setError("");
    const form = event.currentTarget;
    try {
      await saveUser(new FormData(form));
      modal.current.close();
      form.reset();
      setNotice(
        editing ? "User berhasil diperbarui." : "User berhasil ditambahkan.",
      );
      router.refresh();
    } catch {
      setError(
        "User belum dapat disimpan. Periksa keunikan username/email, Role, dan ketentuan password.",
      );
    } finally {
      setPending(false);
    }
  }
  async function confirm() {
    setPending(true);
    setError("");
    try {
      const data = new FormData();
      data.set("id", target.id);
      await deactivateUser(data);
      confirmModal.current.close();
      setTarget(null);
      setNotice("Akun berhasil dinonaktifkan.");
      router.refresh();
    } catch {
      setError(
        "Aksi gagal. Data mungkin masih digunakan atau koneksi database bermasalah.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRASI / PENGGUNA</p>
          <h1>Manajemen User</h1>
          <p>Kelola akun dan akses seluruh anggota tim Anda.</p>
        </div>
        {permissions.create && (
          <button
            className="admin-button"
            onClick={() => {
              openModal(null);
            }}
          >
            <Plus size={18} />
            Tambah User
          </button>
        )}
      </div>
      <div className="stats-grid">
        {[
          ["Total pengguna", rows.length, "Seluruh akun terdaftar"],
          [
            "Pengguna aktif",
            rows.filter((r) => r.isActive).length,
            "Akun yang dapat mengakses aplikasi",
          ],
          [
            "Tenaga tukang",
            rows.filter((r) => r.employeeType === "tukang").length,
            "Anggota tim lapangan",
          ],
        ].map(([label, value, hint]) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">
              {label}
              <span className="stat-icon">
                <Users size={18} />
              </span>
            </div>
            <strong>{value}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      <section className="data-panel">
        <div className="panel-heading">
          <div>
            <h2>
              Daftar Pengguna <span className="count-pill">{rows.length}</span>
            </h2>
            <p>Informasi akun, peran, dan status pengguna.</p>
          </div>
        </div>
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label="Cari data"
              placeholder="Cari nama atau username…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter role"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Semua role</option>
            <>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </>
          </select>
        </div>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Tabel data"
        >
          <table className="admin-table">
            <thead>
              <tr>
                {[
                  "Pengguna",
                  "Username",
                  "Role",
                  "Jadwal Berlaku",
                  "Status",
                  "Aksi",
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <>
                    <td>
                      <div className="user-cell">
                        <span className="avatar">{row.name.slice(0, 1)}</span>
                        <div>
                          <strong>{row.name}</strong>
                          <small>
                            {row.employeeType === "none"
                              ? "Tanpa absensi"
                              : row.employeeType === "tukang"
                                ? "Tukang"
                                : "Karyawan"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td className="muted">@{row.username}</td>
                    <td>
                      <span className="badge role-badge">
                        {roles.find((r) => r.id === row.roleId)?.name ||
                          row.role}
                      </span>
                    </td>
                    <td className="project-address">{row.scheduleLabel}</td>
                    <td>
                      <span
                        className={`badge ${row.isActive ? "badge-active" : "badge-inactive"}`}
                      >
                        <span className="status-dot" />
                        {row.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                  </>
                  <td>
                    {permissions.edit && (
                      <button
                        className="row-action mr-2"
                        onClick={() => {
                          openModal(row);
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {permissions.delete &&
                    row.isActive &&
                    row.role !== "admin" &&
                    row.id !== currentUserId ? (
                      <button
                        className="row-action"
                        onClick={() => {
                          setTarget(row);
                          setError("");
                          confirmModal.current.showModal();
                        }}
                      >
                        Nonaktifkan
                        <ArrowUpRight size={14} />
                      </button>
                    ) : (
                      <span className="muted">
                        {row.id === currentUserId ? "Akun Anda" : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty-state">
              <Inbox size={32} />
              <h3>Tidak ada data</h3>
              <p>
                {query || filter
                  ? "Coba kata pencarian atau filter lainnya."
                  : "Tambahkan data pertama menggunakan tombol di atas."}
              </p>
            </div>
          )}
        </div>
        <div className="table-footer">
          Menampilkan {filtered.length} dari {rows.length} pengguna
        </div>
      </section>
      <dialog
        ref={modal}
        className="admin-dialog"
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <div className="dialog-heading">
          <div>
            <h2>{editing ? "Edit Data" : "Tambah User"}</h2>
            <p>
              {editing
                ? "Perbarui informasi akun."
                : "Buat akun baru untuk anggota tim."}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Tutup"
            disabled={pending}
            onClick={() => modal.current.close()}
          >
            <X size={20} />
          </button>
        </div>
        <form key={editing?.id || "new"} onSubmit={submit}>
          <input type="hidden" name="id" value={editing?.id || ""} />
          <div className="dialog-body form-grid">
            <>
              <label>
                Nama lengkap
                <input
                  name="name"
                  defaultValue={editing?.name || ""}
                  required
                  maxLength={150}
                  placeholder="Nama lengkap pengguna"
                  autoComplete="name"
                />
              </label>
              <label>
                Username
                <input
                  name="username"
                  defaultValue={editing?.username || ""}
                  required
                  minLength={3}
                  maxLength={50}
                  pattern="[a-zA-Z0-9._-]+"
                  placeholder="contoh: budi.santoso"
                  autoComplete="off"
                />
              </label>
              <label className="full-width">
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={editing?.email || ""}
                  required
                  placeholder="nama@perusahaan.com"
                  autoComplete="email"
                />
              </label>
              <label className="full-width">
                Password
                <input
                  name="password"
                  type="password"
                  required={!editing}
                  minLength={12}
                  maxLength={128}
                  placeholder="Min. 12 karakter (A-Z, a-z, 0-9, !@#)"
                  value={passwordInput}
                  onChange={(event) => setPasswordInput(event.target.value)}
                  aria-invalid={
                    !!passwordInput && !!passwordError(passwordInput)
                  }
                  autoComplete="new-password"
                />
                <PasswordRules value={passwordInput} optional={!!editing} />
              </label>
              <label className="full-width">
                Role akses
                <select
                  name="roleId"
                  required
                  defaultValue={editing?.roleId || ""}
                >
                  <option value="">Pilih role</option>
                  {roles.map((r) => (
                    <option value={r.id} key={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="full-width attendance-toggle-row">
                <div>
                  <strong>Aktifkan Absensi</strong>
                  <p>
                    Pengaturan pribadi, terpisah dari hak akses Role. Riwayat
                    tetap tersimpan jika dinonaktifkan.
                  </p>
                </div>
                <label className="attendance-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    name="attendanceEnabled"
                    checked={attendanceEnabled}
                    onChange={(event) =>
                      setAttendanceEnabled(event.target.checked)
                    }
                    aria-label="Aktifkan Absensi"
                  />
                  <span aria-hidden="true" />
                </label>
              </div>
              <input
                type="hidden"
                name="employeeType"
                value={attendanceEnabled ? employeeType : "none"}
              />
              {attendanceEnabled && (
                <label className="full-width">
                  Jenis pekerja
                  <select
                    value={employeeType}
                    onChange={(event) => setEmployeeType(event.target.value)}
                    aria-label="Jenis pekerja"
                  >
                    <option value="karyawan">Karyawan</option>
                    <option value="tukang">Tukang</option>
                  </select>
                </label>
              )}
              <p className="full-width muted text-xs">
                Jadwal dipilih otomatis dari Role untuk Karyawan, serta Project
                lalu Role untuk Tukang.
                {editing?.scheduleLabel && (
                  <span className="block mt-2">
                    Saat ini: {editing.scheduleLabel}
                  </span>
                )}
              </p>
            </>
            {error && (
              <p role="alert" className="error-notice full-width">
                {error}
              </p>
            )}
          </div>
          <div className="dialog-footer">
            <button
              type="button"
              className="admin-button secondary"
              disabled={pending}
              onClick={() => modal.current.close()}
            >
              Batal
            </button>
            <button className="admin-button" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={confirmModal}
        className="admin-dialog confirm-dialog"
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <div className="dialog-body">
          <h2>Nonaktifkan akun?</h2>
          <p>Akun {target?.name || ""} tidak akan dapat mengakses aplikasi.</p>
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
            onClick={() => confirmModal.current.close()}
          >
            Batal
          </button>
          <button
            className="admin-button danger"
            disabled={pending}
            onClick={confirm}
          >
            {pending ? "Memproses…" : "Ya, lanjutkan"}
          </button>
        </div>
      </dialog>
    </>
  );
}
