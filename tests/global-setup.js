import crypto from "node:crypto";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { hashPassword } from "better-auth/crypto";
import { TEST_PASSWORD, testUsers } from "./test-users.js";

dotenv.config({ path: ".env.local" });

export default async function globalSetup() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  const usernames = testUsers.map((user) => user.username);
  await connection.query(
    `DELETE FROM users WHERE username IN (${usernames.map(() => "?").join(", ")})`,
    usernames,
  );

  const [schedules] = await connection.query(
    "SELECT id, schedule_code FROM work_schedules WHERE schedule_code IN ('OFFICE', 'PROJECT')",
  );
  const scheduleIds = Object.fromEntries(
    schedules.map((schedule) => [schedule.schedule_code, schedule.id]),
  );

  const passwordHash = await hashPassword(TEST_PASSWORD);

  for (const user of testUsers) {
    const userId = crypto.randomUUID();

    await connection.execute(
      `INSERT INTO users
        (id, full_name, email, email_verified, username, display_username,
         user_code, role, is_active, work_schedule_id, password_changed_at,
         created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
      [
        userId,
        user.name,
        `${user.username}@absensi.local`,
        user.username,
        user.username,
        user.userCode,
        user.role,
        user.isActive ? 1 : 0,
        scheduleIds[user.scheduleCode] ?? null,
      ],
    );

    await connection.execute(
      `INSERT INTO accounts
        (id, account_id, provider_id, user_id, password, created_at, updated_at)
       VALUES (?, ?, 'credential', ?, ?, NOW(), NOW())`,
      [crypto.randomUUID(), userId, userId, passwordHash],
    );
  }

  console.log(`Test users siap: ${usernames.join(", ")}`);
  await connection.end();
}
