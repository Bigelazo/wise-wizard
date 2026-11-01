import { expect, test } from "@playwright/test";

test("home renders in Spanish with dcc-ui-kit CSS only", async ({ page }) => {
  const failed: string[] = [];
  page.on("requestfailed", (request) => failed.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });

  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("body")).toHaveClass(/dcc-root/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Wise Wizard" }),
  ).toBeVisible();

  const font = await page.evaluate(() => ({
    family: getComputedStyle(document.body).fontFamily,
    loaded: Array.from(document.fonts).some(
      (face) =>
        face.family.replace(/"/g, "") === "Inter" && face.status === "loaded",
    ),
  }));
  expect(font.family).toMatch(/^"?Inter"?/);
  expect(font.loaded).toBe(true);

  const kitScripts = await page.evaluate(() => ({
    global: "DCCUI" in window,
    tags: Array.from(document.scripts)
      .map((script) => script.src)
      .filter((src) => /dcc-(ui|behaviors|icons)/.test(src)),
  }));
  expect(kitScripts).toEqual({ global: false, tags: [] });

  expect(failed).toEqual([]);
});
