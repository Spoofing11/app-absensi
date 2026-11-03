"use client";
import { assignmentDateLabel } from "@/lib/shared/assignment-date";
import { useEffect, useRef, useState } from "react";
import { Bell, X, ArrowLeft, MapPin, CheckCheck } from "lucide-react";
import {
  listNotifications,
  readNotification,
  markAllNotificationsRead,
} from "./actions";

export default function NotificationBell() {
  const [data, setData] = useState({ items: [], unread: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const dialog = useRef(null);
  const active = useRef(true);
  const locked = useRef(false);
  const version = useRef(0);
  useEffect(() => {
    active.current = true;
    let generation = true;
    const update = () => {
      const token = ++version.current;
      return listNotifications()
        .then((result) => {
          if (generation && token === version.current) {
            setData(result);
            setLoading(false);
          }
        })
        .catch(() => {
          if (generation && token === version.current) {
            setError("Notifikasi belum dapat dimuat. Silakan coba lagi.");
            setLoading(false);
          }
        });
    };
    update();
    const timer = setInterval(() => {
      if (!document.hidden && !locked.current) update();
    }, 30000);
    return () => {
      generation = false;
      active.current = false;
      clearInterval(timer);
    };
  }, []);
  async function refresh() {
    const token = ++version.current;
    setLoading(true);
    setError("");
    try {
      const result = await listNotifications();
      if (active.current && token === version.current) setData(result);
    } catch {
      if (active.current && token === version.current)
        setError("Notifikasi belum dapat dimuat. Silakan coba lagi.");
    } finally {
      if (active.current && token === version.current) setLoading(false);
    }
  }
  async function select(id) {
    if (locked.current) return;
    locked.current = true;
    version.current++;
    setLoading(false);
    setBusy(true);
    setError("");
    try {
      const item = await readNotification(id);
      if (active.current) {
        setDetail(item);
        setData((prev) => ({
          ...prev,
          unread: Math.max(
            0,
            prev.unread - (prev.items.find((i) => i.id === id)?.readAt ? 0 : 1),
          ),
          items: prev.items.map((i) =>
            i.id === id ? { ...i, readAt: "read" } : i,
          ),
        }));
      }
    } catch {
      if (active.current)
        setError("Detail notifikasi tidak dapat dibuka. Silakan coba lagi.");
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function markAll() {
    if (locked.current) return;
    locked.current = true;
    version.current++;
    setLoading(false);
    setBusy(true);
    setError("");
    try {
      await markAllNotificationsRead();
      await refresh();
    } catch {
      if (active.current) setError("Notifikasi belum dapat ditandai dibaca.");
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <>
      <button
        className="icon-button notification-bell"
        aria-label={`Notifikasi${data.unread ? `, ${data.unread} belum dibaca` : ""}`}
        onClick={() => {
          setDetail(null);
          dialog.current.showModal();
          refresh();
        }}
      >
        <Bell size={21} />
        {data.unread > 0 && (
          <span className="notification-count">
            {data.unread > 99 ? "99+" : data.unread}
          </span>
        )}
      </button>
      <dialog ref={dialog} className="admin-dialog notification-dialog">
        <div className="dialog-heading">
          <div>
            <h2>{detail ? "Informasi Penempatan" : "Notifikasi"}</h2>
            <p>
              {detail
                ? "Informasi project yang diberikan kepada Anda."
                : `${data.unread} notifikasi belum dibaca`}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Tutup notifikasi"
            onClick={() => dialog.current.close()}
          >
            <X size={20} />
          </button>
        </div>
        {error && (
          <div className="error-notice notification-error" role="alert">
            {error}
            <button
              className="worker-refresh"
              disabled={busy || loading}
              onClick={refresh}
            >
              Coba lagi
            </button>
          </div>
        )}
        {detail ? (
          <div className="dialog-body">
            <button
              className="worker-refresh notification-back"
              onClick={() => setDetail(null)}
            >
              <ArrowLeft size={15} />
              Kembali ke daftar
            </button>
            <p className="notification-message">
              Anda ditempatkan di Project <strong>{detail.projectName}</strong>.
            </p>
            {detail.workDate && (
              <p className="muted">
                Tanggal kerja: {assignmentDateLabel(detail.workDate)}
              </p>
            )}
            <div className="notification-address">
              <MapPin size={18} />
              <p>{detail.projectAddress}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="notification-toolbar">
              <span>Informasi penempatan Anda</span>
              <button
                disabled={busy || loading || !data.unread}
                onClick={markAll}
              >
                <CheckCheck size={15} />
                Tandai semua dibaca
              </button>
            </div>
            {loading ? (
              <div className="empty-state" role="status">
                Memuat notifikasi...
              </div>
            ) : !data.items.length ? (
              <div className="empty-state">
                <Bell size={28} />
                <h3>Belum ada notifikasi</h3>
                <p>Informasi penempatan dari Admin akan muncul di sini.</p>
              </div>
            ) : (
              <ul className="notification-list">
                {data.items.map((item) => (
                  <li key={item.id}>
                    <button
                      disabled={busy}
                      className={item.readAt ? "" : "unread"}
                      onClick={() => select(item.id)}
                    >
                      <span className="notification-item-icon">
                        <Bell size={17} />
                      </span>
                      <span>
                        <strong>Informasi Penempatan</strong>
                        <span>
                          Anda ditempatkan di Project <b>{item.projectName}</b>.
                        </span>
                        <small>
                          {item.workDate && (
                            <>{assignmentDateLabel(item.workDate)} · </>
                          )}
                          {item.readAt ? "Sudah dibaca" : "Belum dibaca"}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="table-footer">
              Menampilkan hingga 50 notifikasi terakhir.
            </p>
          </>
        )}
      </dialog>
    </>
  );
}
