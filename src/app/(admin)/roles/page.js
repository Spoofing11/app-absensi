import EntityManager from "@/components/admin/EntityManager";
import { db } from "@/lib/server/db";
import { roles, rolePermissions, workSchedules } from "@/lib/server/db/schema";
import {
  requirePermission,
  permissionsFor,
} from "@/lib/server/auth/permissions";
export const metadata = { title: "Manajemen Roles" };
export default async function Page() {
  const user = await requirePermission("roles");
  const roleRows = await db
    .select({
      id: roles.id,
      name: roles.name,
      workScheduleId: roles.workScheduleId,
      isSystem: roles.isSystem,
    })
    .from(roles);
  const grants = await db.select().from(rolePermissions);
  const rows = roleRows.map((r) => ({
    ...r,
    permissions: Object.fromEntries(
      grants
        .filter((g) => g.roleId === r.id)
        .map((g) => [
          g.feature,
          { create: g.create, read: g.read, edit: g.edit, delete: g.delete },
        ]),
    ),
  }));
  const schedules = await db
    .select({
      id: workSchedules.id,
      name: workSchedules.name,
      startTime: workSchedules.startTime,
      endTime: workSchedules.endTime,
      isActive: workSchedules.isActive,
    })
    .from(workSchedules);
  return (
    <EntityManager
      schedules={schedules}
      kind="roles"
      rows={rows}
      permissions={(await permissionsFor(user)).roles}
    />
  );
}
