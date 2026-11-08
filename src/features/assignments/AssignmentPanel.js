"use client";
import { useTimedNotice } from "@/components/ui/useTimedNotice";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, X, CalendarDays } from "lucide-react";
import { saveAssignment, deleteAssignment } from "./actions";
import AssignmentDay from "./AssignmentDay";
import { assignmentDateLabel } from "@/lib/shared/assignment-date";

export default function AssignmentPanel({
  rows,
  workers,
  projects,
  permissions = {},
  today,
}) {
  const router = useRouter();
  const modal = useRef(null);
  const confirmation = useRef(null);
  const [editing, setEditing] = useState(null);
  const [target, setTarget] = useState(null);
  const [date, setDate] = useState(today);
  const [selected, setSelected] = useState([]);
  const [workerQuery, setWorkerQuery] = useState("");
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [tab, setTab] = useState("today");
  const [presetProject, setPresetProject] = useState("");
  const [formVersion, setFormVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useTimedNotice();
  function open(row = null, workDate = today, projectId = "") {
    flushSync(() => {
      setEditing(row);
      setDate(row?.workDate || workDate);
      setPresetProject(projectId);
      setFormVersion((value) => value + 1);
      setSelected(row ? [row.workerId] : []);
      setWorkerQuery("");
      setError("");
    });
    modal.current.showModal();
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await saveAssignment(new FormData(event.currentTarget));
      if (result?.error) {
        setError(result.error);
        return;
      }
      const savedDate = date;
      setTab(
        savedDate === today
          ? "today"
          : savedDate > today
            ? "future"
            : "history",
      );
      setDateFilter(savedDate);
      setProjectFilter("");
      setQuery("");
      setPage(1);
      modal.current.close();
      setNotice("Penempatan berhasil disimpan.");
      router.refresh();
    } catch {
      setError(
        "Penempatan belum dapat disimpan. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("id", target.id);
      const result = await deleteAssignment(form);
      if (result?.error) {
        setError(result.error);
        return;
      }
      confirmation.current.close();
      setNotice("Penempatan berhasil dihapus.");
      router.refresh();
    } catch {
      setError("Penempatan belum dapat dihapus. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  function matchesTab(row, value) {
    return value === "today"
      ? row.workDate === today
      : value === "future"
        ? row.workDate > today
        : !row.workDate || row.workDate < today;
  }
  const tabs = [
    { id: "today", label: "Hari Ini" },
    { id: "future", label: "Mendatang" },
    { id: "history", label: "Riwayat" },
  ];
  const filtered = rows.filter(
    (row) =>
      matchesTab(row, tab) &&
      (!dateFilter || row.workDate === dateFilter) &&
      (!projectFilter || row.projectId === projectFilter) &&
      `${row.worker} ${row.project}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const dates = [...new Set(filtered.map((row) => row.workDate))].sort(
    (a, b) =>
      !a
        ? 1
        : !b
          ? -1
          : tab === "future"
            ? a.localeCompare(b)
            : b.localeCompare(a),
  );
  const pages = Math.max(1, Math.ceil(dates.length / 7));
  const currentPage = Math.min(page, pages);
  const visibleDates = dates.slice((currentPage - 1) * 7, currentPage * 7);
  const options = [...workers];
  if (editing && !options.some((worker) => worker.id === editing.workerId))
    options.push({ id: editing.workerId, name: editing.worker });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MANAJEMEN OPERASIONAL</p>
          <h2>Penempatan Harian</h2>
          <p>Atur project dan tim untuk setiap tanggal kerja.</p>
        </div>
        {permissions.create && (
          <button className="admin-button" onClick={() => open()}>
            <Plus size={17} />
            Tambah Penempatan
          </button>
        )}
      </div>
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      <nav className="assignment-tabs" aria-label="Periode penempatan">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => {
              setTab(item.id);
              setDateFilter("");
              setPage(1);
            }}
          >
            {item.label}
            <span>
              {
                new Set(
                  rows
                    .filter((row) => matchesTab(row, item.id))
                    .map((row) => `${row.workDate}:${row.projectId}`),
                ).size
              }
            </span>
          </button>
        ))}
      </nav>
      <section className="content-card assignment-filter">
        <label>
          Cari tukang / project
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Ketik nama tukang atau project"
          />
        </label>
        <label>
          Tanggal kerja
          <input
            type="date"
            value={dateFilter}
            onChange={(event) => {
              const value = event.target.value;
              setDateFilter(value);
              if (value)
                setTab(
                  value === today
                    ? "today"
                    : value > today
                      ? "future"
                      : "history",
                );
              setPage(1);
            }}
          />
        </label>
        <label>
          Project
          <select
            value={projectFilter}
            onChange={(event) => {
              setProjectFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua project</option>
            {[
              ...new Map(
                rows.map((row) => [
                  row.projectId,
                  { id: row.projectId, name: row.project },
                ]),
              ).values(),
            ].map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="admin-button secondary"
          onClick={() => {
            setDateFilter("");
            setProjectFilter("");
            setQuery("");
            setPage(1);
          }}
        >
          Reset Filter
        </button>
      </section>
      {!filtered.length && (
        <section className="content-card empty-state">
          <CalendarDays size={30} />
          <h2>
            {tab === "today"
              ? "Belum ada penempatan hari ini"
              : tab === "future"
                ? "Belum ada penempatan mendatang"
                : "Belum ada riwayat penempatan"}
          </h2>
          <p>Tambahkan penempatan atau sesuaikan filter pencarian.</p>
        </section>
      )}
      <div className="assignment-date-list">
        {visibleDates.map((day, index) => {
          const projectIds = new Set(
            filtered
              .filter((row) => row.workDate === day)
              .map((row) => row.projectId),
          );
          const daily = rows.filter(
            (row) => row.workDate === day && projectIds.has(row.projectId),
          );
          return (
            <AssignmentDay
              key={`${tab}:${day || "legacy"}`}
              day={day}
              today={today}
              rows={daily}
              permissions={permissions}
              initialOpen={index === 0}
              onAdd={() => open(null, day)}
              onEdit={open}
              onDelete={(row) => {
                setTarget(row);
                setError("");
                confirmation.current.showModal();
              }}
            />
          );
        })}
      </div>
      {dates.length > 0 && (
        <nav className="assignment-pagination" aria-label="Halaman penempatan">
          <button
            className="admin-button secondary"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Sebelumnya
          </button>
          <span>
            Halaman {currentPage} dari {pages}
          </span>
          <button
            className="admin-button secondary"
            disabled={currentPage >= pages}
            onClick={() => setPage(currentPage + 1)}
          >
            Berikutnya
          </button>
        </nav>
      )}
      <dialog
        ref={modal}
        className="admin-dialog"
        aria-labelledby="assignment-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <div className="dialog-heading">
          <div>
            <h2 id="assignment-title">
              {editing ? "Ubah" : "Tambah"} Penempatan
            </h2>
            <p>Satu tukang hanya dapat memiliki satu project per hari.</p>
          </div>
          <button
            className="icon-button"
            disabled={busy}
            aria-label="Tutup"
            onClick={() => modal.current.close()}
          >
            <X size={20} />
          </button>
        </div>
        <form key={formVersion} onSubmit={submit}>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <fieldset disabled={busy} className="assignment-fieldset">
            <div className="dialog-body form-grid">
              <label>
                Tanggal kerja
                <input
                  type="date"
                  name="workDate"
                  required
                  min="2000-01-01"
                  max="2100-12-31"
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setSelected([]);
                  }}
                />
              </label>
              <label>
                Project
                <select
                  name="projectId"
                  required
                  defaultValue={editing?.projectId || presetProject}
                >
                  <option value="">Pilih project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="assignment-worker-field">
                <span>
                  Tukang {selected.length > 0 && `(${selected.length} dipilih)`}
                </span>
                <p className="muted">
                  {editing
                    ? "Pilih satu tukang."
                    : "Pilih hingga 100 tukang untuk project dan tanggal ini."}
                </p>
                <input
                  type="search"
                  className="assignment-worker-search"
                  aria-label="Cari nama tukang"
                  placeholder="Cari nama tukang…"
                  value={workerQuery}
                  onChange={(event) => setWorkerQuery(event.target.value)}
                />
                <div className="assignment-worker-options">
                  {/* Keep checked inputs mounted so searching preserves submitted selections. */}
                  {options.map((worker) => {
                    const conflict = rows.find(
                      (row) =>
                        row.workerId === worker.id &&
                        row.workDate === date &&
                        row.id !== editing?.id,
                    );
                    return (
                      <label
                        key={worker.id}
                        className={
                          conflict
                            ? "unavailable"
                            : selected.includes(worker.id)
                              ? "is-selected"
                              : ""
                        }
                        style={
                          !worker.name
                            .toLowerCase()
                            .includes(workerQuery.trim().toLowerCase())
                            ? { display: "none" }
                            : undefined
                        }
                      >
                        <input
                          type={editing ? "radio" : "checkbox"}
                          name="workerId"
                          value={worker.id}
                          disabled={!!conflict}
                          checked={selected.includes(worker.id) && !conflict}
                          onChange={(event) =>
                            setSelected(
                              editing
                                ? [worker.id]
                                : event.target.checked
                                  ? [...selected, worker.id]
                                  : selected.filter((id) => id !== worker.id),
                            )
                          }
                        />
                        <span>
                          {worker.name}
                          {conflict && (
                            <small>
                              Sudah ditempatkan di {conflict.project}
                            </small>
                          )}
                        </span>
                        {(conflict || selected.includes(worker.id)) && (
                          <span className="assignment-worker-badge">
                            {conflict ? "Sudah ditempatkan" : "Dipilih"}
                          </span>
                        )}
                      </label>
                    );
                  })}
                  {!options.length && (
                    <p className="muted">Belum ada tukang aktif.</p>
                  )}
                  {options.length > 0 &&
                    !options.some((worker) =>
                      worker.name
                        .toLowerCase()
                        .includes(workerQuery.trim().toLowerCase()),
                    ) && (
                      <p className="muted" role="status">
                        Tidak ada tukang yang cocok dengan pencarian.
                      </p>
                    )}
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
                onClick={() => modal.current.close()}
              >
                Batal
              </button>
              <button
                className="admin-button"
                disabled={!selected.length || selected.length > 100}
              >
                {busy ? "Menyimpan…" : "Simpan Penempatan"}
              </button>
            </div>
          </fieldset>
        </form>
      </dialog>
      <dialog
        ref={confirmation}
        className="admin-dialog confirm-dialog"
        aria-labelledby="delete-assignment-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <div className="dialog-body">
          <h2 id="delete-assignment-title">Hapus penempatan?</h2>
          <p>
            {target?.worker} di {target?.project},{" "}
            {assignmentDateLabel(target?.workDate)}.
          </p>
          <p>
            Tukang tidak lagi ditugaskan ke project ini pada tanggal tersebut.
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
            onClick={() => confirmation.current.close()}
          >
            Batal
          </button>
          <button className="admin-button" disabled={busy} onClick={remove}>
            {busy ? "Menghapus…" : "Hapus"}
          </button>
        </div>
      </dialog>
    </>
  );
}
