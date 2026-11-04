import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { activityLogs, roles } from "@/lib/server/db/schema";

export async function isSystemAdministrator(user) {
  if (user.role !== "admin" || !user.roleId) return false;
  const [role] = await db.select({ isSystem: roles.isSystem }).from(roles)
    .where(eq(roles.id, user.roleId)).limit(1);
  return role?.isSystem === true;
}

export async function recordActivity(connection, actor, feature, action, detail) {
  await connection.insert(activityLogs).values({
    id: randomUUID(),
    actorName: actor.name,
    actorUsername: actor.username,
    feature,
    action,
    detail,
  });
}

// Better Auth owns its session transaction. A logging failure must not undo login or logout.
export async function recordSessionActivity(actor, action, detail) {
  try {
    await recordActivity(db, actor, "auth", action, detail);
  } catch {
    console.error("Pencatatan aktivitas sesi gagal.");
  }
}
