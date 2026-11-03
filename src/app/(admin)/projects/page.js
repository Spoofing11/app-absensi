import EntityManager from "@/components/admin/EntityManager";
import { db } from "@/lib/server/db";
import { projects, workSchedules } from "@/lib/server/db/schema";
import {
  requirePermission,
  permissionsFor,
} from "@/lib/server/auth/permissions";
export const metadata = { title: "Manajemen Projects" };
export default async function Page() {
  const user = await requirePermission("projects");
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      address: projects.address,
      workScheduleId: projects.workScheduleId,
    })
    .from(projects);
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
      kind="projects"
      rows={rows}
      permissions={(await permissionsFor(user)).projects}
    />
  );
}
