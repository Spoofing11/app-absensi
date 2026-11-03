import { chromium, expect as baseExpect } from "@playwright/test";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { formatInTimeZone } from "date-fns-tz";
import { unlink, mkdir } from "node:fs/promises";
import path from "node:path";
const expect = baseExpect.configure({ timeout: 30000 });
dotenv.config({ path: ".env.local", quiet: true });
const c = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  timezone: "Z",
});
const suffix = randomUUID().slice(0, 8);
const role = randomUUID(),
  schedule = randomUUID();
const users = [randomUUID(), randomUUID()];
const password = randomUUID() + "x";
const tz = process.env.APP_TIMEZONE || "Asia/Jakarta";
const now = new Date();
const date = formatInTimeZone(now, tz, "yyyy-MM-dd");
const root = path.resolve(process.env.STORAGE_ROOT || "./storage");
const browser = await chromium.launch({
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const base = "http://localhost:3000";
async function login(page, username, pass) {
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(120000);
  await page.goto(base + "/login");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL(/\/(dashboard|admin\/dashboard)$/);
}
try {
  await mkdir("test-results", { recursive: true });
  await c.execute(
    "INSERT INTO work_schedules (id,schedule_code,name,start_time,end_time) VALUES (?,?,?,'09:00:00','17:00:00')",
    [schedule, "QA-H-" + suffix, "QA History " + suffix],
  );
  await c.execute(
    "INSERT INTO roles (id,name,work_schedule_id) VALUES (?,?,?)",
    [role, "QA Current " + suffix, schedule],
  );
  await c.execute(
    "INSERT INTO role_permissions (role_id,feature,can_read,can_create,can_edit) VALUES (?,'attendance',1,1,1)",
    [role],
  );
  for (let index = 0; index < users.length; index++) {
    const id = users[index],
      username = `qa_history_${suffix}_${index}`;
    await c.execute(
      "INSERT INTO users (id,full_name,email,username,user_code,role,role_id,employee_type) VALUES (?,?,?,?,?,'karyawan',?,'karyawan')",
      [
        id,
        `QA History ${suffix} ${index}`,
        username + "@example.invalid",
        username,
        username,
        role,
      ],
    );
    await c.execute(
      "INSERT INTO accounts (id,account_id,provider_id,user_id,password) VALUES (?,?,'credential',?,?)",
      [randomUUID(), id, id, await hashPassword(password)],
    );
    await c.execute(
      "INSERT INTO attendances (id,attendance_code,user_id,work_date,work_schedule_id,user_code_snapshot,full_name_snapshot,role_snapshot,role_id_snapshot,role_name_snapshot,schedule_code_snapshot,schedule_name_snapshot,timezone_snapshot,scheduled_start_at,scheduled_end_at,check_in_at,late_seconds) VALUES (?,?,?,?,?,?,?,'karyawan',?,?,?,?,?,?,?,?,?)",
      [
        randomUUID(),
        `QA-H-${suffix}-${index}`,
        id,
        date,
        schedule,
        username,
        `QA History ${suffix} ${index}`,
        role,
        "QA Snapshot " + suffix,
        "QA-H-" + suffix,
        "QA History " + suffix,
        tz,
        new Date(now.getTime() - 4 * 3600000),
        new Date(now.getTime() + (index === 0 ? 2 : -1) * 3600000),
        new Date(now.getTime() - 2 * 3600000),
        index === 0 ? 7200 : 0,
      ],
    );
    const context = await browser.newContext({ permissions: ["camera"] });
    const page = await context.newPage();
    await login(page, username, password);
    if (index === 0)
      await expect(page.getByText(/Anda terlambat 2 jam/)).toBeVisible();
    await page
      .getByRole("button", { name: "Absen Pulang", exact: true })
      .click();
    const dialog = page.getByRole("dialog").filter({ visible: true });
    if (index === 0) {
      await expect(dialog.getByLabel("Alasan pulang lebih awal")).toBeVisible();
      for (const width of [360, 390, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        if (
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          )
        )
          throw new Error("Checkout dialog overflow " + width);
      }
    } else
      await expect(dialog.getByLabel("Alasan pulang lebih awal")).toHaveCount(
        0,
      );
    await expect(
      dialog.getByRole("button", { name: "Ambil Foto", exact: true }),
    ).toBeEnabled();
    await dialog
      .getByRole("button", { name: "Ambil Foto", exact: true })
      .click();
    if (index === 0) {
      await expect(
        dialog.getByRole("button", { name: "Simpan Absensi", exact: true }),
      ).toBeDisabled();
      await dialog.getByLabel("Alasan pulang lebih awal").selectOption("Sakit");
      await dialog
        .getByLabel("Keterangan")
        .fill("Sakit dan perlu istirahat di rumah");
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: "test-results/early-checkout-mobile.png",
        fullPage: true,
      });
    }
    await dialog
      .getByRole("button", { name: "Simpan Absensi", exact: true })
      .click();
    await expect(
      page.getByText("Selesai bekerja", { exact: true }),
    ).toBeVisible();
    const [[saved]] = await c.execute(
      "SELECT early_seconds,early_reason_category FROM attendances WHERE user_id=?",
      [id],
    );
    if (
      index === 0 &&
      (!saved.early_seconds || saved.early_reason_category !== "Sakit")
    )
      throw new Error("Early reason missing");
    if (index === 1 && (saved.early_seconds || saved.early_reason_category))
      throw new Error("Late checkout incorrectly needs reason");
    console.log(
      index === 0 ? "EARLY_REASON_UI_OK" : "LATE_CHECKOUT_WITHOUT_REASON_OK",
    );
    await context.close();
  }
  const admin = await browser.newPage();
  await login(
    admin,
    process.env.SEED_ADMIN_USERNAME || "admin",
    process.env.SEED_ADMIN_PASSWORD,
  );
  const target =
    base +
    "/history?" +
    new URLSearchParams({ from: date, to: date, q: "QA History " + suffix });
  await admin.goto(target);
  await expect(
    admin
      .locator(".history-group summary")
      .getByText("QA Snapshot " + suffix, { exact: true }),
  ).toBeVisible();
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await admin.setViewportSize({ width, height: 900 });
    if (
      await admin.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error("History overflow " + width);
  }
  await admin.setViewportSize({ width: 1440, height: 1000 });
  await expect
    .poll(() =>
      admin.evaluate(
        () =>
          document.querySelector(".admin-main").getBoundingClientRect().left >=
          document.querySelector(".admin-sidebar").getBoundingClientRect()
            .right,
      ),
    )
    .toBeTruthy();
  console.log("LAYOUT",await admin.evaluate(()=>[".admin-sidebar",".admin-main",".admin-content",".page-heading"].map(selector=>{const element=document.querySelector(selector);const r=element.getBoundingClientRect();return {selector,left:r.left,width:r.width,margin:getComputedStyle(element).marginLeft};})));
  await admin.screenshot({
    path: "test-results/history-desktop.png",
    fullPage: true, animations:"disabled",
  });
  await admin
    .getByRole("row")
    .filter({ hasText: `QA History ${suffix} 0` })
    .getByRole("link", { name: "Detail", exact: true })
    .click();
  await expect(
    admin.getByText("Sakit dan perlu istirahat di rumah", { exact: true }),
  ).toBeVisible();
  await expect(
    admin.getByRole("img", { name: "Foto pulang", exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        admin
          .getByRole("img", { name: "Foto pulang", exact: true })
          .evaluate((image) => image.complete && image.naturalWidth > 0),
      { timeout: 120000 },
    )
    .toBeTruthy();
  await admin.goto(target + "&view=recap");
  await expect(
    admin.getByRole("columnheader", { name: "Hari hadir", exact: true }),
  ).toBeVisible();
  console.log("HISTORY_DETAIL_RECAP_RESPONSIVE_OK");
} finally {
  await browser.close();
  const [files] = await c.query(
    "SELECT storage_key FROM media_files WHERE owner_user_id IN (?,?)",
    users,
  );
  await c.query("DELETE FROM attendances WHERE user_id IN (?,?)", users);
  await c.query("DELETE FROM media_files WHERE owner_user_id IN (?,?)", users);
  await c.query("DELETE FROM users WHERE id IN (?,?)", users);
  await c.execute("DELETE FROM roles WHERE id=?", [role]);
  await c.execute("DELETE FROM work_schedules WHERE id=?", [schedule]);
  for (const file of files) {
    const target = path.resolve(root, file.storage_key);
    if (path.dirname(target) !== root)
      throw new Error("Unexpected QA media path");
    await unlink(target);
  }
  await c.end();
}
