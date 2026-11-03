import { chromium, expect } from "@playwright/test";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { unlink, mkdir } from "node:fs/promises";
import path from "node:path";
dotenv.config({ path: ".env.local", quiet: true });
const c = await mysql.createConnection(process.env.DATABASE_URL);
const ids = {
  role: randomUUID(),
  schedule: randomUUID(),
  project: randomUUID(),
};
const password = randomUUID() + "x";
const suffix = randomUUID().slice(0, 8);
const people = [
  { id: randomUUID(), username: "qa_emp_" + suffix, type: "karyawan" },
  { id: randomUUID(), username: "qa_work_" + suffix, type: "tukang" },
];
const browser = await chromium.launch({
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const base = "http://localhost:3000";
await mkdir("test-results", { recursive: true });
try {
  await c.execute("INSERT INTO roles (id,name) VALUES (?,?)", [
    ids.role,
    "QA Worker UI " + suffix,
  ]);
  await c.execute(
    "INSERT INTO role_permissions (role_id,feature,can_create,can_read,can_edit) VALUES (?,'attendance',1,1,1)",
    [ids.role],
  );
  await c.execute(
    "INSERT INTO work_schedules (id,schedule_code,name,start_time,end_time) VALUES (?,?,?,'08:00:00','17:00:00')",
    [ids.schedule, "QA-" + suffix, "Jadwal QA"],
  );
  await c.execute(
    "INSERT INTO projects (id,project_code,name,address) VALUES (?,?,?,?)",
    [ids.project, "QA-" + suffix, "Project QA", "Alamat project pengujian"],
  );
  await c.execute("UPDATE roles SET work_schedule_id=? WHERE id=?", [
    ids.schedule,
    ids.role,
  ]);
  for (const person of people) {
    await c.execute(
      "INSERT INTO users (id,full_name,email,username,user_code,role,role_id,employee_type,work_schedule_id) VALUES (?,?,?,?,?,?,?,?,?)",
      [
        person.id,
        "QA " + person.type,
        person.username + "@example.invalid",
        person.username,
        person.username,
        person.type,
        ids.role,
        person.type,
        ids.schedule,
      ],
    );
    await c.execute(
      "INSERT INTO accounts (id,account_id,provider_id,user_id,password) VALUES (?,?,'credential',?,?)",
      [randomUUID(), person.id, person.id, await hashPassword(password)],
    );
    if (person.type === "tukang")
      await c.execute(
        "INSERT INTO project_assignments (id,assignment_code,worker_id,project_id,start_date,created_by_id,is_active) VALUES (?,?,?,?,?,?,1)",
        [
          randomUUID(),
          "QA-" + suffix,
          person.id,
          ids.project,
          "2020-01-01",
          person.id,
        ],
      );
  }
  for (const person of people) {
    const context = await browser.newContext({ permissions: ["camera"] });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(180000);
    await page.addInitScript(() => {
      window.cameraCalls = 0;
      window.cameraStreams = [];
      const original = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      navigator.mediaDevices.getUserMedia = async (options) => {
        window.cameraCalls++;
        const stream = await original(options);
        window.cameraStreams.push(stream);
        return stream;
      };
    });
    await page.goto(base + "/login");
    await page.locator("#username").fill(person.username);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await page.waitForURL("**/dashboard");
    await expect(
      page.getByRole("heading", { name: "Absensi Saya", exact: true }),
    ).toBeVisible();
    if ((await page.evaluate(() => window.cameraCalls)) !== 0)
      throw new Error("Camera opened before user action");
    if (person.type === "tukang")
      await expect(page.getByText("Project QA", { exact: true })).toBeVisible();
    for (const width of [360, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw new Error("Page overflow " + person.type + " " + width);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `test-results/worker-${person.type}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Absen Masuk", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Ambil Foto", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Ambil Foto", exact: true }).click();
    await expect(
      page.getByRole("img", { name: "Preview foto absensi Anda" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Ambil Ulang", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Ambil Foto", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Tutup kamera" }).click();
    if (
      !(await page.evaluate(() =>
        window.cameraStreams.every((s) =>
          s.getTracks().every((t) => t.readyState === "ended"),
        ),
      ))
    )
      throw new Error("Camera stream leaked");
    await page
      .getByRole("button", { name: "Absen Masuk", exact: true })
      .click();
    await page.getByRole("button", { name: "Ambil Foto", exact: true }).click();
    await page
      .getByRole("button", { name: "Simpan Absensi", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Absen Pulang", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Absen Pulang", exact: true })
      .click();
    await page.getByRole("button", { name: "Ambil Foto", exact: true }).click();
    await page
      .getByRole("button", { name: "Simpan Absensi", exact: true })
      .click();
    await expect(
      page.getByText("Selesai bekerja", { exact: true }),
    ).toBeVisible();
    const [[record]] = await c.execute(
      "SELECT COUNT(*) n, MAX(check_in_photo_id IS NOT NULL AND check_out_photo_id IS NOT NULL) photos FROM attendances WHERE user_id=?",
      [person.id],
    );
    if (record.n !== 1 || !record.photos)
      throw new Error("Attendance not saved correctly");
    console.log("WORKER_FLOW_OK", person.type);
    if (person.type === "karyawan") {
      await c.execute("DELETE FROM attendances WHERE user_id=?", [person.id]);
      await c.execute("UPDATE roles SET work_schedule_id=NULL WHERE id=?", [
        ids.role,
      ]);
      await page.reload();
      await expect(
        page.getByText("Jadwal kerja belum ditentukan. Hubungi Admin.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Absen Masuk", exact: true }),
      ).toBeDisabled();
      console.log("MISSING_SCHEDULE_EXPLAINED");
      await c.execute("UPDATE roles SET work_schedule_id=? WHERE id=?", [
        ids.schedule,
        ids.role,
      ]);
    }
    await context.close();
  }
} finally {
  await browser.close();
  const userIds = people.map((p) => p.id);
  const [files] = await c.query(
    "SELECT storage_key FROM media_files WHERE owner_user_id IN (?,?)",
    userIds,
  );
  await c.query("DELETE FROM attendances WHERE user_id IN (?,?)", userIds);
  await c.query(
    "DELETE FROM media_files WHERE owner_user_id IN (?,?)",
    userIds,
  );
  await c.query(
    "DELETE FROM project_assignments WHERE worker_id IN (?,?)",
    userIds,
  );
  await c.query("DELETE FROM users WHERE id IN (?,?)", userIds);
  await c.execute("DELETE FROM projects WHERE id=?", [ids.project]);
  await c.execute("DELETE FROM work_schedules WHERE id=?", [ids.schedule]);
  await c.execute("DELETE FROM roles WHERE id=?", [ids.role]);
  const root = path.resolve(process.env.STORAGE_ROOT || "./storage");
  for (const file of files) {
    const target = path.resolve(root, file.storage_key);
    if (path.dirname(target) !== root)
      throw new Error("Unexpected storage path");
    await unlink(target);
  }
  await c.end();
}
