import { chromium } from "playwright";

const BASE_URL = process.env.APP_BASE_URL || "https://contentautomationplatform-production.up.railway.app";
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error("Missing TEST_EMAIL / TEST_PASSWORD env vars");
}

const out = (name) => `./output/ui/${name}.png`;

async function ensureLoggedIn(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });

  // Best-effort selectors (don’t log credentials)
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);

  // Submit
  const btn = page.getByRole("button", { name: /log in|sign in/i });
  await btn.click();

  // Wait for redirect off /login
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 60_000 });
}

async function snap(page, path, waitMs = 400) {
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path, fullPage: true });
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

  // Reduce noisy animations
  await page.addStyleTag({ content: `*{scroll-behavior:auto !important; transition:none !important; animation:none !important;}` });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await ensureLoggedIn(page);
  }

  // Dashboard (top)
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await snap(page, out("01_dashboard_top"));

  // Dashboard (consistency tracker)
  const ct = page.getByText(/consistency tracker/i).first();
  if (await ct.count().catch(() => 0)) {
    await ct.scrollIntoViewIfNeeded();
  } else {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.45));
  }
  await snap(page, out("02_dashboard_consistency"));

  // Insights overview (top)
  await page.goto(`${BASE_URL}/insights?tab=overview`, { waitUntil: "domcontentloaded" });
  await snap(page, out("03_insights_overview_top"));

  // Expand heatmap
  const heatmapSummary = page.getByText(/engagement heatmap/i).first();
  if (await heatmapSummary.count().catch(() => 0)) {
    await heatmapSummary.click();
  }
  await snap(page, out("04_insights_heatmap"));

  // Scroll to performance section (posts/replies lists)
  await page.goto(`${BASE_URL}/insights?tab=overview#performance`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(200);
  await snap(page, out("05_insights_performance"));

  // Voice page
  await page.goto(`${BASE_URL}/voice`, { waitUntil: "domcontentloaded" });
  await snap(page, out("06_voice_settings"));

  // Create page
  await page.goto(`${BASE_URL}/create`, { waitUntil: "domcontentloaded" });
  await snap(page, out("07_create_top"));

  // Best-effort: open inspiration picker modal (only present if there are inspirations)
  const addInspo = page.getByRole("button", { name: /add inspiration|change inspiration/i }).first();
  if (await addInspo.count().catch(() => 0)) {
    await addInspo.click();
    await snap(page, out("08_create_inspiration_modal"));
    // close modal
    await page.keyboard.press("Escape");
  }

  await browser.close();

  console.log(JSON.stringify({
    baseUrl: BASE_URL,
    files: [
      out("01_dashboard_top"),
      out("02_dashboard_consistency"),
      out("03_insights_overview_top"),
      out("04_insights_heatmap"),
      out("05_insights_performance"),
      out("06_voice_settings"),
      out("07_create_top"),
      out("08_create_inspiration_modal"),
    ]
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
