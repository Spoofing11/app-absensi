import { redirect } from "next/navigation";
import { requireAttendanceUser } from "@/lib/server/auth/attendance";
export default async function Page() {
  await requireAttendanceUser({ redirectOnDenied: true });
  redirect("/dashboard");
}
