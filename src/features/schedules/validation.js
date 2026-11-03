import "server-only";
import { eq } from "drizzle-orm";
import { workSchedules } from "@/lib/server/db/schema";
export async function assertActiveSchedule(tx, id) {
  if (!id) return;
  const [schedule] = await tx
    .select()
    .from(workSchedules)
    .where(eq(workSchedules.id, id))
    .for("share");
  if (!schedule?.isActive) throw new Error("Pilih jadwal kerja yang aktif.");
}
