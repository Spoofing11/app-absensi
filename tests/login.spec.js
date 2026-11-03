import fs from "node:fs";
import { expect, test } from "@playwright/test";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { TEST_PASSWORD } from "./test-users.js";

dotenv.config({ path: ".env.local" });

const adminUsername = process.env.SEED_ADMIN_USERNAME ?? "admin";
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const visualsDir = "test-results/visuals";

fs.mkdirSync(visualsDir, { recursive: true });

test.beforeAll(() => {
  if (!adminPassword) {
    throw new Error("SEED_ADMIN_PASSWORD tidak ditemukan di .env.local.");
  }
});

async function hideDevOverlay(page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

async function gotoLogin(page) {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "PT Composite Interior Prima" }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    [...document.images].every((image) => image.complete),
  );
  await page
    .locator("section img")
    .first()
    .evaluate((image) => image.decode());
  await page.waitForTimeout(250);
  await hideDevOverlay(page);
}

async function submitLogin(page, username, password) {
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

test("menampilkan validasi field kosong", async ({ page }) => {
  await gotoLogin(page);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();

  await expect(page.getByText("Username wajib diisi.")).toBeVisible();
  await expect(page.getByText("Password wajib diisi.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("menolak password salah", async ({ page }) => {
  await gotoLogin(page);
  await submitLogin(page, adminUsername, "password-salah-123");

  const errorAlert = page
    .getByRole("alert")
    .filter({ hasText: "Username atau password salah." });

  await expect(errorAlert).toBeVisible();
  await expect(errorAlert).not.toContainText(adminPassword);
  await expect(page).toHaveURL(/\/login$/);
});

test("menolak akun nonaktif", async ({ page }) => {
  await gotoLogin(page);
  await submitLogin(page, "test_inactive", TEST_PASSWORD);

  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Akun Anda tidak aktif. Hubungi Admin." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("mengarahkan admin ke dashboard admin", async ({ page }, testInfo) => {
  await gotoLogin(page);
  await submitLogin(page, adminUsername, adminPassword);

  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toContainText("Selamat datang");
  await expect(page.getByText("ADM-0001")).toBeVisible();
  await hideDevOverlay(page);

  await page.screenshot({
    path: `${visualsDir}/dashboard-admin-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("mengarahkan karyawan ke dashboard user", async ({ page }) => {
  await gotoLogin(page);
  await submitLogin(page, "test_karyawan", TEST_PASSWORD);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("TST-KRY-001")).toBeVisible();
});

test("mengarahkan tukang ke dashboard user", async ({ page }) => {
  await gotoLogin(page);
  await submitLogin(page, "test_tukang", TEST_PASSWORD);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("TST-TKG-001")).toBeVisible();
});

test("menolak karyawan membuka area admin", async ({ page }) => {
  await gotoLogin(page);
  await submitLogin(page, "test_karyawan", TEST_PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("mengakhiri sesi akun yang dinonaktifkan", async ({ page }) => {
  await gotoLogin(page);
  await submitLogin(page, "test_karyawan", TEST_PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/);

  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    const [beforeRows] = await connection.execute(
      "SELECT COUNT(*) AS count FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = ?)",
      ["test_karyawan"],
    );

    await connection.execute(
      "UPDATE users SET is_active = 0 WHERE username = ?",
      ["test_karyawan"],
    );

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?reason=inactive$/);
    await expect(
      page.getByText("Akun Anda tidak aktif. Hubungi Admin."),
    ).toBeVisible();

    const [afterRows] = await connection.execute(
      "SELECT COUNT(*) AS count FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = ?)",
      ["test_karyawan"],
    );

    expect(afterRows[0].count).toBe(beforeRows[0].count - 1);
  } finally {
    await connection.execute(
      "UPDATE users SET is_active = 1 WHERE username = ?",
      ["test_karyawan"],
    );
    await connection.end();
  }
});

test("mengakhiri sesi saat logout", async ({ page }) => {
  await gotoLogin(page);
  await submitLogin(page, adminUsername, adminPassword);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  await page.getByRole("button", { name: "Keluar", exact: true }).click();

  await expect(page).toHaveURL(/\/login\?reason=logout$/);
  await expect(page.getByText("Anda telah keluar.")).toBeVisible();

  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/login\?reason=expired$/);
});

test("menerima username dengan huruf besar", async ({ page }) => {
  await gotoLogin(page);
  await submitLogin(page, adminUsername.toUpperCase(), adminPassword);

  await expect(page).toHaveURL(/\/admin\/dashboard$/);
});

test("mengalihkan sesi aktif dari halaman login", async ({ page }) => {
  await gotoLogin(page);
  await submitLogin(page, adminUsername, adminPassword);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  await page.goto("/login");
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
});

test("mempertahankan sesi setelah reload", async ({ page }) => {
  await gotoLogin(page);
  await submitLogin(page, adminUsername, adminPassword);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  await page.reload();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByText(`@${adminUsername}`)).toBeVisible();
});

test("mengarahkan pengunjung tanpa sesi ke login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?reason=expired$/);
  await expect(page.getByText("Sesi Anda berakhir.")).toBeVisible();
});

test("screenshot visual login desktop", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await gotoLogin(page);

  await page.screenshot({
    path: `${visualsDir}/login-desktop.png`,
    fullPage: true,
  });
});

test("screenshot visual login mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await gotoLogin(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);

  const fontSize = await page
    .locator("#username")
    .evaluate((element) => getComputedStyle(element).fontSize);
  expect(fontSize).toBe("16px");

  await page.screenshot({
    path: `${visualsDir}/login-mobile.png`,
    fullPage: true,
  });
});
