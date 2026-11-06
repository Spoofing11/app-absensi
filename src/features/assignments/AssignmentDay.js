"use client";
import { Fragment, useId, useState } from "react";
import { CalendarDays, ChevronDown, MapPin, Plus, Users } from "lucide-react";
import { assignmentDateLabel } from "@/lib/shared/assignment-date";

const attendanceLabels = {
  in: "Sudah masuk",
  out: "Sudah pulang",
  none: "Belum absen",
  sick: "Sakit",
  leave: "Izin",
  unexcused: "Tanpa Keterangan",
};

export default function AssignmentDay({
  day,
  today,
  rows,
  permissions,
  initialOpen,
  onAdd,
  onEdit,
  onDelete,
}) {
  const [expanded, setExpanded] = useState(initialOpen);
  const [openProjects, setOpenProjects] = useState({});
  const id = useId();
  const projectIds = [...new Set(rows.map((row) => row.projectId))];
  return (
    <section className="assignment-overview-day">
      <header className="assignment-overview-heading">
        <button
          type="button"
          className="assignment-day-toggle"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
        >
          <CalendarDays size={20} aria-hidden="true" />
          <span>
            <strong>{assignmentDateLabel(day)}</strong>
            <small>
              {projectIds.length} project · {rows.length} penempatan tukang
            </small>
          </span>
          <ChevronDown
            size={18}
            className={expanded ? "is-expanded" : ""}
            aria-hidden="true"
          />
        </button>
        <div className="assignment-overview-actions">
          <span
            className={`badge ${day === today ? "badge-active" : "role-badge"}`}
          >
            {!day
              ? "Arsip"
              : day === today
                ? "Hari ini"
                : day > today
                  ? "Terjadwal"
                  : "Riwayat"}
          </span>
          {day && permissions.create && (
            <button
              type="button"
              className="admin-button secondary"
              onClick={onAdd}
              aria-label={`Tambah penempatan untuk ${assignmentDateLabel(day)}`}
            >
              <Plus size={14} />
              Tambah Penempatan
            </button>
          )}
        </div>
      </header>
      <div id={id} hidden={!expanded}>
        <table className="assignment-overview-table">
          <caption className="sr-only">
            Project dan tim pada {assignmentDateLabel(day)}
          </caption>
          <thead>
            <tr>
              <th scope="col">Project</th>
              <th scope="col">Jumlah Tukang</th>
              <th scope="col">Status Absensi</th>
              <th scope="col">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {projectIds.map((projectId, index) => {
              const team = rows.filter((row) => row.projectId === projectId);
              const counts = {
                in: 0,
                out: 0,
                none: 0,
                sick: 0,
                leave: 0,
                unexcused: 0,
              };
              for (const row of team) counts[row.attendanceStatus || "none"]++;
              const opened = !!openProjects[projectId];
              const detailId = `${id}-project-${index}`;
              return (
                <Fragment key={projectId}>
                  <tr className="assignment-project-summary">
                    <td data-label="Project">
                      <strong>{team[0].project}</strong>
                      <span className="assignment-project-location">
                        <MapPin size={13} aria-hidden="true" />
                        {team[0].address}
                      </span>
                    </td>
                    <td data-label="Jumlah Tukang">
                      <span className="assignment-team-count">
                        <Users size={15} aria-hidden="true" />
                        {team.length} tukang
                      </span>
                    </td>
                    <td data-label="Status Absensi">
                      <div className="assignment-attendance-counts">
                        {!day ? (
                          <span className="muted">Data historis</span>
                        ) : !counts.in &&
                          !counts.out &&
                          !counts.sick &&
                          !counts.leave &&
                          !counts.unexcused ? (
                          <span className="muted">Belum ada absensi</span>
                        ) : (
                          <>
                            {counts.in > 0 && (
                              <span className="badge badge-active">
                                {counts.in} sudah masuk
                              </span>
                            )}
                            {counts.out > 0 && (
                              <span className="badge role-badge">
                                {counts.out} sudah pulang
                              </span>
                            )}
                            {["sick", "leave", "unexcused"]
                              .filter((status) => counts[status] > 0)
                              .map((status) => (
                                <span className="badge role-badge" key={status}>
                                  {counts[status]} {attendanceLabels[status]}
                                </span>
                              ))}
                            {counts.none > 0 && (
                              <span className="muted">
                                {counts.none} belum absen
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td data-label="Aksi">
                      <button
                        type="button"
                        className="admin-button secondary assignment-detail-toggle"
                        aria-expanded={opened}
                        aria-controls={detailId}
                        aria-label={`${opened ? "Tutup" : "Lihat"} detail ${team[0].project}, ${assignmentDateLabel(day)}`}
                        onClick={() =>
                          setOpenProjects((previous) => ({
                            ...previous,
                            [projectId]: !previous[projectId],
                          }))
                        }
                      >
                        {opened ? "Tutup Detail" : "Lihat Detail"}
                        <ChevronDown
                          size={14}
                          className={opened ? "is-expanded" : ""}
                          aria-hidden="true"
                        />
                      </button>
                    </td>
                  </tr>
                  <tr className="assignment-detail-row" hidden={!opened}>
                    <td colSpan={4}>
                      <div id={detailId} className="assignment-project-detail">
                        <h3>Tim {team[0].project}</h3>
                        <p className="muted">
                          {day
                            ? "Penempatan yang sudah dipakai absensi atau ketidakhadiran dilindungi. Hapus catatan ketidakhadiran dahulu untuk mengubah penempatannya."
                            : "Arsip penempatan lama tanpa tanggal kerja."}
                        </p>
                        <ul className="assignment-team">
                          {team.map((row) => (
                            <li key={row.id}>
                              <div>
                                <strong>{row.worker}</strong>
                                {day && (
                                  <small
                                    className={
                                      row.attendanceStatus === "in"
                                        ? "assignment-attendance-active"
                                        : "muted"
                                    }
                                  >
                                    {
                                      attendanceLabels[
                                        row.attendanceStatus || "none"
                                      ]
                                    }
                                  </small>
                                )}
                                {row.used && (
                                  <small className="muted">
                                    Sudah digunakan untuk pencatatan · Terkunci
                                  </small>
                                )}
                              </div>
                              <div className="assignment-row-actions">
                                {day && !row.used && permissions.edit && (
                                  <button
                                    type="button"
                                    className="admin-button secondary"
                                    onClick={() => onEdit(row)}
                                    aria-label={`Ubah penempatan ${row.worker}`}
                                  >
                                    Ubah
                                  </button>
                                )}
                                {day && !row.used && permissions.delete && (
                                  <button
                                    type="button"
                                    className="admin-button secondary"
                                    onClick={() => onDelete(row)}
                                    aria-label={`Hapus penempatan ${row.worker}`}
                                  >
                                    Hapus
                                  </button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
