import EntityManager from "@/components/admin/EntityManager";
import { db } from "@/lib/server/db";
import { workSchedules } from "@/lib/server/db/schema";
import {
  requirePermission,
  permissionsFor,
} from "@/lib/server/auth/permissions";
export const metadata = { title: "Jadwal Kerja" };
export default async function Page() {
  const user = await requirePermission("schedules");
  const rows = await db
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
      kind="schedules"
      rows={rows}
      permissions={(await permissionsFor(user)).schedules}
    />
  );
}
