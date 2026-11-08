import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/server/db";
import { roles, rolePermissions } from "@/lib/server/db/schema";
import { requireUser } from "./session";
import {
  FEATURES,
  OPERATIONS,
  allowed,
  supportsOperation,
} from "@/lib/shared/permissions";
export async function permissionsFor(user) {
  const [role] = user.roleId
    ? await db.select().from(roles).where(eq(roles.id, user.roleId))
    : [];
  if (user.role === "admin" && role?.isSystem)
    return Object.fromEntries(
      Object.keys(FEATURES).map((f) => [
        f,
        Object.fromEntries(OPERATIONS.map((op) => [op, true])),
      ]),
    );
  const rows = user.roleId
    ? await db
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, user.roleId))
    : [];
  return Object.fromEntries(
    rows
      .filter((r) => Object.hasOwn(FEATURES, r.feature))
      .map((r) => [
        r.feature,
        Object.fromEntries(
          OPERATIONS.map((op) => [
            op,
            supportsOperation(r.feature, op) && r[op],
          ]),
        ),
      ]),
  );
}
export async function requirePermission(feature, operation = "read") {
  const user = await requireUser();
  const permissions = await permissionsFor(user);
  if (!allowed(permissions, feature, operation)) {
    if (operation === "read") redirect("/access-denied");
    throw new Error("Anda tidak memiliki hak akses untuk tindakan ini.");
  }
  return user;
}
export async function requireWorkspace() {
  const user = await requireUser();
  const permissions = await permissionsFor(user);
  if (
    ![
      "users",
      "roles",
      "projects",
      "assignments",
      "schedules",
      "history",
      "absences",
      "approvals",
      "photo-recap",
    ].some((f) => allowed(permissions, f, "read")) &&
    user.role !== "admin"
  )
    redirect("/dashboard");
  return { user, permissions };
}
