import "@/components/app/workspace.css";
import { isSystemAdministrator } from "@/features/activity-logs/server";
import SidebarNav from "@/components/admin/SidebarNav";
import { requireWorkspace } from "@/lib/server/auth/permissions";
export const metadata = { title: "Admin Panel - Portal Absensi" };
export default async function AdminLayout({ children }) {
  const { user, permissions } = await requireWorkspace();
  return (
    <div className="admin-shell">
      <SidebarNav
        user={{
          name: user.name,
          role: user.role,
          username: user.username,
          profilePhotoId: user.profilePhotoId,
          attendanceEnabled: user.attendanceEnabled,
          employeeType: user.employeeType,
          isActive: user.isActive,
        }}
        permissions={permissions}
        canReadActivityLog={await isSystemAdministrator(user)}
      />
      <main className="admin-main">
        <div className="admin-content">{children}</div>
        <footer className="admin-footer">
          PT Composite Interior Prima <span>Portal Absensi</span>
        </footer>
      </main>
    </div>
  );
}
