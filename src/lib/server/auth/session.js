import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { sessions, users } from "@/lib/server/db/schema";
import { auth } from "@/lib/server/auth";

export function homePathForRole(role) {
  return role === "admin" ? "/admin/dashboard" : "/dashboard";
}

/**
 * Mengambil sesi + user, lalu membaca ulang status & role dari database.
 * Pemeriksaan ulang ini memastikan akun nonaktif dan perubahan role langsung
 * berlaku pada permintaan berikutnya.
 *
 * Fungsi ini dipakai di Server Component, jadi tidak boleh mengubah cookie.
 */
async function getSessionContext() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    return null;
  }

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      profilePhotoId: users.profilePhotoId,
      attendanceEnabled: users.attendanceEnabled,
      username: users.username,
      userCode: users.userCode,
      role: users.role,
      roleId: users.roleId,
      employeeType: users.employeeType,
      isActive: users.isActive,
      workScheduleId: users.workScheduleId,
      phoneNumber: users.phoneNumber,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return null;
  }

  return { user, session: session.session };
}

export async function getSessionUser() {
  const context = await getSessionContext();
  return context?.user ?? null;
}

export async function requireUser() {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login?reason=expired");
  }

  if (!context.user.isActive) {
    // Cabut sesi langsung di database; Server Component tidak boleh menulis
    // cookie lewat signOut.
    if (context.session?.token) {
      await db
        .delete(sessions)
        .where(eq(sessions.token, context.session.token));
    }

    redirect("/login?reason=inactive");
  }

  return context.user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  return user;
}
