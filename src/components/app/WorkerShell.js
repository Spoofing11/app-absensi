import InstallApp from "@/components/pwa/InstallApp";
import Link from "next/link";
import NotificationBell from "@/features/notifications/NotificationBell";
import { Logo } from "@/components/brand/Logo";
import AccountMenu from "./AccountMenu";
import "./workspace.css";
export default function WorkerShell({
  user,
  canManage,
  children,
  hideFooter = false,
}) {
  return (
    <div className="admin-shell worker-shell">
      <header className="worker-header">
        <Link className="worker-brand" href="/dashboard">
          <Logo size={38} />
          <span>
            <strong>COMPOSITE</strong>
            <small>PORTAL ABSENSI</small>
          </span>
        </Link>
        <div className="worker-header-actions">
          {user.role !== "admin" && <NotificationBell />}
          {canManage && (
            <Link className="admin-button secondary" href="/admin/dashboard">
              Pengelolaan
            </Link>
          )}
          <AccountMenu user={user} />
        </div>
      </header>
      <main className="worker-main">
        {children}
        <InstallApp />
      </main>
      {!hideFooter && (
        <footer className="admin-footer worker-footer">
          PT Composite Interior Prima<span>Portal Absensi</span>
        </footer>
      )}
    </div>
  );
}
