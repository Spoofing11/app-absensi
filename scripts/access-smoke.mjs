import { chromium, expect } from "@playwright/test";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
dotenv.config({ path: ".env.local", quiet: true });
const c = await mysql.createConnection(process.env.DATABASE_URL);
const fixture = {
  role: randomUUID(),
  user: randomUUID(),
  password: randomUUID() + "x",
  username: "qa_" + randomUUID().slice(0, 8),
};
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (error) => console.log("BROWSER_ERROR", error.message));
page.setDefaultNavigationTimeout(180000);
page.setDefaultTimeout(60000);
const url = "http://localhost:3000";
let captured;
page.on("request", (request) => {
  if (
    !captured &&
    request.method() === "POST" &&
    request.url().endsWith("/projects") &&
    request.headers()["next-action"]
  )
    captured = { headers: request.headers(), body: request.postDataBuffer() };
});
async function login(p, username, password) {
  await p.goto(url + "/login");
  await p.locator("#username").fill(username);
  await p.locator("#password").fill(password);
  await p.getByRole("button", { name: "Masuk", exact: true }).click();
  await p.waitForURL(/\/(admin\/dashboard|dashboard)$/);
}
try {
  await c.execute("INSERT INTO roles (id,name) VALUES (?,?)", [
    fixture.role,
    "QA " + fixture.username,
  ]);
  await c.execute(
    "INSERT INTO role_permissions (role_id,feature,can_read) VALUES (?,'projects',1)",
    [fixture.role],
  );
  await c.execute(
    "INSERT INTO users (id,full_name,email,username,user_code,role,role_id,employee_type) VALUES (?,?,?,?,?,'karyawan',?,'karyawan')",
    [
      fixture.user,
      "QA Worker",
      fixture.username + "@example.invalid",
      fixture.username,
      fixture.username,
      fixture.role,
    ],
  );
  await c.execute(
    "INSERT INTO accounts (id,account_id,provider_id,user_id,password) VALUES (?,?,'credential',?,?)",
    [
      randomUUID(),
      fixture.user,
      fixture.user,
      await hashPassword(fixture.password),
    ],
  );
  await login(
    page,
    process.env.SEED_ADMIN_USERNAME || "admin",
    process.env.SEED_ADMIN_PASSWORD,
  );
  await page.goto(url + "/admin/dashboard");
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Absensi", exact: true }),
  ).toHaveCount(0);
  await page.goto(url + "/attendance");
  await expect(page).toHaveURL(/access-denied/);
  console.log("ADMIN_ATTENDANCE_DENIED");
  await page.goto(url + "/projects");
  await page.getByRole("button", { name: "Tambah Project" }).click();
  await page
    .getByLabel("Nama project", { exact: true })
    .fill("QA Project " + fixture.username);
  await page.getByLabel("Alamat", { exact: true }).fill("Alamat pengujian");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(
    page.getByRole("dialog", { open: true }).filter({ visible: true }),
  ).toHaveCount(0);
  let row = page
    .getByRole("row")
    .filter({ hasText: "QA Project " + fixture.username });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Alamat", { exact: true }).fill("Alamat diperbarui");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(row).toContainText("Alamat diperbarui");
  console.log("PROJECT_CREATE_EDIT_OK");
  await page.goto(url + "/users");
  await page.getByRole("button", { name: "Tambah User", exact: true }).click();
  const userForm = page.getByRole("dialog").filter({ visible: true });
  await userForm.locator('[name="name"]').fill("QA UI Worker");
  await userForm.locator('[name="username"]').fill(fixture.username + "u");
  await userForm
    .locator('[name="email"]')
    .fill(fixture.username + "u@example.invalid");
  await userForm.locator('[name="password"]').fill(fixture.password);
  await userForm.locator('[name="roleId"]').selectOption(fixture.role);
  await userForm.locator('[name="employeeType"]').selectOption("tukang");
  await userForm.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(userForm).toHaveCount(0);
  const [[uiUser]] = await c.execute(
    "SELECT id,role_id,employee_type FROM users WHERE username=?",
    [fixture.username + "u"],
  );
  if (uiUser?.role_id !== fixture.role || uiUser.employee_type !== "tukang")
    throw new Error("User role/type not saved");
  const [[project]] = await c.execute("SELECT id FROM projects WHERE name=?", [
    "QA Project " + fixture.username,
  ]);
  await page.goto(url + "/assignments");
  await page
    .getByRole("button", { name: "Tambah Penempatan", exact: true })
    .click();
  const assignmentForm = page.getByRole("dialog").filter({ visible: true });
  await assignmentForm.locator('[name="workerId"]').selectOption(uiUser.id);
  await assignmentForm.locator('[name="projectId"]').selectOption(project.id);
  await assignmentForm
    .getByRole("button", { name: "Simpan", exact: true })
    .click();
  await expect(assignmentForm).toHaveCount(0);
  await page.goto(url + "/projects");
  let usedProject = page
    .getByRole("row")
    .filter({ hasText: "QA Project " + fixture.username });
  await usedProject.getByRole("button", { name: "Hapus", exact: true }).click();
  await page
    .getByRole("dialog")
    .filter({ visible: true })
    .getByRole("button", { name: "Hapus", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  await page.goto(url + "/assignments");
  const assignmentRow = page
    .getByRole("row")
    .filter({ hasText: "QA Project " + fixture.username });
  await assignmentRow
    .getByRole("button", { name: "Akhiri", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ya, lanjutkan", exact: true })
    .click();
  await expect(
    assignmentRow.getByText("Diakhiri", { exact: true }),
  ).toBeVisible();
  console.log("USER_ROLE_ASSIGNMENT_AND_PROJECT_RELATION_OK");
  const restricted = await browser.newPage();
  await login(restricted, fixture.username, fixture.password);
  await restricted.goto(url + "/projects");
  await expect(
    restricted.getByRole("heading", { name: "Manajemen Project", exact: true }),
  ).toBeVisible();
  await expect(
    restricted.getByRole("button", { name: "Tambah Project" }),
  ).toHaveCount(0);
  await expect(
    restricted.getByRole("button", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await restricted.goto(url + "/roles");
  await expect(restricted).toHaveURL(/access-denied/);
  console.log("READ_ONLY_AND_DIRECT_ROUTE_DENIAL_OK");
  if (!captured) throw new Error("Missing Server Action request");
  const [[before]] = await c.execute(
    "SELECT COUNT(*) AS n FROM projects WHERE name=?",
    ["QA Project " + fixture.username],
  );
  await restricted.context().request.post(url + "/projects", {
    headers: {
      "next-action": captured.headers["next-action"],
      "content-type": captured.headers["content-type"],
      origin: url,
    },
    data: captured.body,
  });
  const [[after]] = await c.execute(
    "SELECT COUNT(*) AS n FROM projects WHERE name=?",
    ["QA Project " + fixture.username],
  );
  if (before.n !== after.n) throw new Error("Unauthorized action mutated data");
  console.log("SERVER_ACTION_WRITE_DENIED");
  await restricted.close();
  await page.goto(url + "/roles");
  row = page.getByRole("row").filter({ hasText: "QA " + fixture.username });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Manajemen Project create", exact: true })
    .check();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("dialog").filter({ visible: true })).toHaveCount(
    0,
  );
  const [[grant]] = await c.execute(
    "SELECT can_create FROM role_permissions WHERE role_id=? AND feature='projects'",
    [fixture.role],
  );
  if (!grant.can_create) throw new Error("Grant not persisted");
  console.log("ROLE_EDIT_GRANT_OK");
  await row.getByRole("button", { name: "Hapus", exact: true }).click();
  await page
    .getByRole("dialog")
    .filter({ visible: true })
    .getByRole("button", { name: "Hapus", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  console.log("USED_ROLE_DELETE_DENIED");
  // Remove only this test fixture history before exercising project deletion.
  await c.execute("DELETE FROM project_assignments WHERE worker_id=?", [
    uiUser.id,
  ]);
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  await page.goto(url + "/projects");
  row = page
    .getByRole("row")
    .filter({ hasText: "QA Project " + fixture.username });
  await row.getByRole("button", { name: "Hapus", exact: true }).click();
  await page
    .getByRole("dialog")
    .filter({ visible: true })
    .getByRole("button", { name: "Hapus", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  console.log("PROJECT_DELETE_OK");
  await page.goto(url + "/roles");
  await page.getByRole("button", { name: "Tambah Role", exact: true }).click();
  await page
    .getByLabel("Nama role", { exact: true })
    .fill("QA Created " + fixture.username);
  await page
    .getByRole("checkbox", { name: "Manajemen Project read", exact: true })
    .check();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  row = page
    .getByRole("row")
    .filter({ hasText: "QA Created " + fixture.username });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Hapus", exact: true }).click();
  await page
    .getByRole("dialog")
    .filter({ visible: true })
    .getByRole("button", { name: "Hapus", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  console.log("ROLE_CREATE_DELETE_OK");
} catch (error) {
  await page
    .screenshot({ path: "test-results/access-failure.png", fullPage: true })
    .catch(() => {});
  console.log("PAGE", page.url());
  throw error;
} finally {
  await browser.close();
  await c.execute(
    "DELETE FROM project_assignments WHERE worker_id IN (SELECT id FROM users WHERE username=?)",
    [fixture.username + "u"],
  );
  await c.execute("DELETE FROM users WHERE username=?", [
    fixture.username + "u",
  ]);
  await c.execute("DELETE FROM projects WHERE name=?", [
    "QA Project " + fixture.username,
  ]);
  await c.execute("DELETE FROM users WHERE id=?", [fixture.user]);
  await c.execute("DELETE FROM roles WHERE id=? OR name=?", [
    fixture.role,
    "QA Created " + fixture.username,
  ]);
  await c.end();
}
