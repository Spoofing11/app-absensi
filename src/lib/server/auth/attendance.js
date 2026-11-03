import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "./session";
import { canUseAttendance } from "@/lib/shared/attendance-access";
export async function requireAttendanceUser({ redirectOnDenied = false } = {}) {
  const user = await requireUser();
  if (!canUseAttendance(user)) {
    if (redirectOnDenied) redirect("/access-denied");
    throw new Error("Absensi pribadi tidak aktif untuk akun Anda.");
  }
  return user;
}
