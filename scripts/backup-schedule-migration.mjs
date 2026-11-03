import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
dotenv.config({ path: ".env.local", quiet: true });
const c = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [users] = await c.query(
    "SELECT id,role_id,employee_type,work_schedule_id FROM users",
  );
  const [assignments] = await c.query("SELECT * FROM project_assignments");
  const [roles] = await c.query("SELECT * FROM roles");
  const [projects] = await c.query("SELECT * FROM projects");
  await mkdir("storage/backups", { recursive: true });
  await writeFile(
    `storage/backups/schedule-migration-${Date.now()}.json`,
    JSON.stringify({ users, roles, projects, assignments }),
    { flag: "wx" },
  );
  console.log("BACKUP_OK", {
    users: users.length,
    assignments: assignments.length,
  });
} finally {
  await c.end();
}
