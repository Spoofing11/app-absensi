import { resolveWorkSchedule } from "@/features/schedules/resolver";
import { db } from "@/lib/server/db";
import { users, roles } from "@/lib/server/db/schema";
import { desc } from "drizzle-orm";
import {
  requirePermission,
  permissionsFor,
} from "@/lib/server/auth/permissions";
import ManagementPanel from "@/components/admin/ManagementPanel";
export const metadata = { title: "Manajemen User" };
export default async function UsersPage() {
  const admin = await requirePermission("users");
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      email: users.email,
      workScheduleId: users.workScheduleId,
      role: users.role,
      roleId: users.roleId,
      employeeType: users.employeeType,
      attendanceEnabled: users.attendanceEnabled,
      isActive: users.isActive,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
  const roleRows = await db
    .select({ id: roles.id, name: roles.name, isSystem: roles.isSystem })
    .from(roles);
  const displayRows = await Promise.all(
    rows.map(async (row) => {
      const resolved = await resolveWorkSchedule(db, row);
      return {
        ...row,
        scheduleLabel: resolved.schedule
          ? `${resolved.schedule.startTime.slice(0, 5)}–${resolved.schedule.endTime.slice(0, 5)} · ${resolved.source}`
          : resolved.blockedReason,
      };
    }),
  );
  return (
    <ManagementPanel
      roles={roleRows}
      permissions={(await permissionsFor(admin)).users}
      rows={displayRows}
      currentUserId={admin.id}
    />
  );
}
