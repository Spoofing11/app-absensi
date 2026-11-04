import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { passwordError } from "../../shared/password.js";
import { db, pool } from "./index.js";
import { accounts, users, workSchedules } from "./schema/index.js";

const scheduleSeeds = [
  {
    scheduleCode: "OFFICE",
    name: "Office",
    startTime: "09:00:00",
    endTime: "17:00:00",
    description: "Jam kerja kantor.",
  },
  {
    scheduleCode: "WORKSHOP",
    name: "Workshop",
    startTime: "08:00:00",
    endTime: "17:00:00",
    description: "Jam kerja bengkel produksi.",
  },
  {
    scheduleCode: "PROJECT",
    name: "Proyek",
    startTime: "09:00:00",
    endTime: "17:00:00",
    description: "Jam kerja di lokasi proyek.",
  },
];

async function seedSchedules() {
  for (const schedule of scheduleSeeds) {
    const [existing] = await db
      .select({ id: workSchedules.id })
      .from(workSchedules)
      .where(eq(workSchedules.scheduleCode, schedule.scheduleCode))
      .limit(1);

    if (existing) {
      console.log(`- Jadwal ${schedule.scheduleCode} sudah ada, dilewati.`);
      continue;
    }

    await db.insert(workSchedules).values({
      id: crypto.randomUUID(),
      ...schedule,
      isActive: true,
    });
    console.log(`+ Jadwal ${schedule.scheduleCode} dibuat.`);
  }
}

async function seedAdmin() {
  const username = String(process.env.SEED_ADMIN_USERNAME ?? "admin")
    .trim()
    .toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_NAME ?? "Administrator";

  if (passwordError(password)) {
    throw new Error(
      "SEED_ADMIN_PASSWORD wajib diisi (tepat 8 karakter) di .env.local.",
    );
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existing) {
    console.log(`- Admin "${username}" sudah ada, dilewati.`);
    return;
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      name: fullName,
      email: `${username}@absensi.local`,
      emailVerified: true,
      username,
      displayUsername: username,
      userCode: "ADM-0001",
      role: "admin",
      attendanceEnabled: false,
      roleId: "00000000-0000-4000-8000-000000000001",
      employeeType: "none",
      isActive: true,
      workScheduleId: null,
      passwordChangedAt: new Date(),
    });

    await tx.insert(accounts).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    });
  });

  console.log(`+ Admin "${username}" dibuat.`);
}

async function main() {
  await seedSchedules();
  await seedAdmin();
  console.log("Seed selesai.");
}

main()
  .catch((error) => {
    console.error("Seed gagal:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
