import { chromium } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(180000);
await page.goto("http://localhost:3000/login");
await page
  .locator("#username")
  .fill(process.env.SEED_ADMIN_USERNAME || "admin");
await page.locator("#password").fill(process.env.SEED_ADMIN_PASSWORD);
await page.getByRole("button", { name: "Masuk", exact: true }).click();
await page.waitForURL("**/admin/dashboard", { timeout: 60000 });
for (const route of [
  "/users",
  "/assignments",
  "/schedules",
  "/roles",
  "/projects",
  "/admin/dashboard",
]) {
  await page.goto("http://localhost:3000" + route);
  await page.locator("h1").waitFor();
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    if (overflow) {
      console.log(
        await page.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              right: e.getBoundingClientRect().right,
            }))
            .slice(0, 15),
        ),
      );
      await page.screenshot({ path: "test-results/ui-overflow.png" });
      throw new Error("Overflow " + route + " at " + width);
    }
  }
  console.log("RESPONSIVE_OK", route);
}
await page.goto("http://localhost:3000/users");
await page.setViewportSize({ width: 1440, height: 1000 });
await page.screenshot({
  path: "test-results/ui-users-desktop.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Tambah User", exact: true }).click();
await page.getByRole("dialog").filter({ visible: true }).waitFor();
await page.setViewportSize({ width: 360, height: 800 });
await page.screenshot({
  path: "test-results/ui-user-dialog-mobile.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Batal", exact: true }).click();
await page.getByRole("button", { name: "Buka menu" }).click();
await page.getByRole("dialog").filter({ visible: true }).waitFor();
await page.keyboard.press("Escape");
await page
  .getByRole("textbox", { name: "Cari data" })
  .fill("no-matching-account-xyz");
await page.getByRole("heading", { name: "Tidak ada data" }).waitFor();
console.log("INTERACTIONS_OK");
await browser.close();
