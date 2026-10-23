import assert from "node:assert/strict";
import { chromium } from "playwright";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, inArray } from "drizzle-orm";
import { boolean, pgTable, text } from "drizzle-orm/pg-core";
import "dotenv/config";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
const testSessions = pgTable("sessions", { tokenHash: text("token_hash").primaryKey(), principalId: text("principal_id") });
const testUsers = pgTable("users", { id: text("id").primaryKey(), isDemo: boolean("is_demo") });
const createdUsers = new Set();
const pageErrors = [];
let browser;
let checks = 0;

function checked(message) { checks += 1; console.log(`✓ ${message}`); }
function testHeaders() {
  return { "X-Forwarded-For": `198.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` };
}
async function route(page, name) {
  await page.waitForFunction((expected) => location.hash.split("/")[0] === `#${expected}`, name, { timeout: 12000 });
}
async function browserBack(page, name) {
  await page.evaluate(() => history.back());
  await route(page, name);
}
async function openStudy(page, checkWelcome = false) {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 25000 });
  const button = page.getByRole("button", { name: "Open for Study", exact: true });
  await button.waitFor();
  if (checkWelcome) {
    assert.equal(await page.locator(".welcome-area .brand-copy strong").innerText(), "Prayas Point");
    assert.equal(await page.locator(".welcome-area .brand-copy small").innerText(), "रेलवे ग्रुप डी की पूरी तैयारी");
    assert.match(await page.locator(".welcome-content h2").innerText(), /Your preparation.*starts here/s);
    assert.equal(await page.locator(".welcome-area button").count(), 1);
    for (const selector of ["#phone-number", "#otp-code", ".country-code", ".config-note", ".auth-divider", ".demo-btn"]) {
      assert.equal(await page.locator(selector).count(), 0, `${selector} should not be on the welcome screen`);
    }
    checked("welcome has Prayas Point branding, one study button, and no phone/OTP/demo controls");
  }
  await button.click();
  await route(page, "home");
  await page.getByRole("heading", { name: /Hello, Guest/i }).waitFor();
  const response = await page.evaluate(async () => (await fetch("/api/bootstrap")).json());
  assert.equal(response.data.user.isDemo, true); // Legacy database marker for an unverified session.
  assert.equal(response.data.user.verifiedPhone, false);
  assert.ok(response.data.user.id.startsWith("guest-"));
  createdUsers.add(response.data.user.id);
  await page.reload({ waitUntil: "domcontentloaded" });
  await route(page, "home");
  await page.getByRole("heading", { name: /Hello, Guest/i }).waitFor();
  checked("Open for Study creates a persistent, unverified guest study session");
  return response.data;
}
async function fromHome(page, selector, destination) {
  assert.equal(new URL(page.url()).hash, "#home", `Expected Home before clicking ${selector}`);
  await page.locator(selector).first().click();
  await route(page, destination);
  await browserBack(page, "home");
  checked(`${selector} opens ${destination} and Back returns Home`);
}
async function mobileFlow() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["clipboard-read", "clipboard-write"], extraHTTPHeaders: testHeaders() });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => pageErrors.push(`mobile: ${error.message}`));
  const data = await openStudy(page, true);
  assert.equal(data.categories.filter((exam) => exam.isActive).length, 1);
  assert.equal(data.categories.find((exam) => exam.id === "railway-group-d")?.isActive, true);
  checked("Railway Group D is the only active seeded category");

  const homeTargets = [
    [".quick-grid .info-card:nth-child(1)", "library"], [".quick-grid .info-card:nth-child(2)", "quizzes"], [".quick-grid .info-card:nth-child(3)", "tests"],
    [".feature-grid .feature-card:nth-child(1)", "paid-courses"], [".feature-grid .feature-card:nth-child(2)", "youtube"],
    [".feature-grid .feature-card:nth-child(3)", "tests"], [".feature-grid .feature-card:nth-child(4)", "library"],
    [".feature-grid .feature-card:nth-child(5)", "shorts"], [".feature-grid .feature-card:nth-child(6)", "job-alerts"],
    [".banner-copy button", "syllabus"], [".dashboard-primary .section-link", "syllabus"],
    [".recent-section .text-action", "quizzes"], [".plan-card .plan-item button", "syllabus"],
    [".plan-card .plan-item + .plan-item button", "quizzes"], [".plan-card .plan-cta", "syllabus"],
    [".snapshot-card .section-link", "progress"], [".continue-card .continue-link", "syllabus"],
    [".dashboard-footer-row > div:nth-child(1) button", "bookmarks"], [".dashboard-footer-row > div:nth-child(2) button", "progress"],
  ];
  for (const [selector, destination] of homeTargets) await fromHome(page, selector, destination);
  await page.locator(".banner-dots button").nth(1).click();
  assert.equal(await page.locator(".banner-dots button").nth(1).getAttribute("aria-current"), "true");
  await fromHome(page, ".banner-copy button", "quizzes");
  checked("carousel indicators and configured banner destination work");

  for (const [position, target] of [[1, "my-courses"], [2, "downloads"], [3, "chat"], [4, "more"]]) {
    await page.locator(".bottom-nav button").nth(position).click();
    await route(page, target);
    if (target === "chat") {
      assert.match(await page.locator("main.app-content").innerText(), /coming soon/i);
      await page.getByRole("button", { name: /Get support/i }).click();
      await route(page, "help");
      await browserBack(page, "chat");
    }
    if (target === "downloads") {
      await page.getByRole("button", { name: /Browse library/i }).click();
      await route(page, "library");
      await browserBack(page, "downloads");
    }
    if (target === "my-courses") {
      await page.getByRole("button", { name: /Continue learning/i }).click();
      await route(page, "group-d");
      await browserBack(page, "my-courses");
      const future = page.locator(".coming-course-grid button").first();
      assert.match(await future.innerText(), /Coming soon/i);
      await future.click();
      await route(page, "coming-soon");
      await browserBack(page, "my-courses");
    }
    await browserBack(page, "home");
    checked(`mobile bottom navigation ${target}, child actions, and Back`);
  }
  await page.locator(".bottom-nav button").nth(1).click();
  await route(page, "my-courses");
  await page.locator(".bottom-nav button").nth(0).click();
  await route(page, "home");
  assert.deepEqual(await page.evaluate(() => history.state.stack.map((screen) => screen.name)), ["home"]);
  await page.evaluate(() => history.back());
  await page.getByRole("status").filter({ hasText: "Press back again to exit" }).waitFor();
  await route(page, "home");
  checked("Home tab resets the stack; first browser Back shows exit message");

  await page.locator(".exam-select").click();
  await route(page, "exams");
  const search = page.getByRole("textbox", { name: "Search exam categories" });
  await search.fill("NTPC");
  assert.equal(await page.locator(".exam-card").count(), 1);
  await page.locator(".search-field button").click();
  assert.equal(await search.inputValue(), "");
  for (const exam of data.categories.filter((item) => item.id !== "railway-group-d")) {
    await search.fill(exam.name);
    const card = page.locator(".exam-card").filter({ hasText: exam.name }).first();
    await card.waitFor();
    assert.match(await card.innerText(), /Coming soon/i);
    await card.click();
    await route(page, "coming-soon");
    assert.match(await page.locator("main.app-content h1").first().innerText(), new RegExp(exam.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    await browserBack(page, "exams");
  }
  await search.fill("Group D");
  assert.equal(await page.locator(".exam-card").count(), 1);
  assert.match(await page.locator(".exam-card").innerText(), /Active/);
  await page.locator(".exam-card").click();
  await route(page, "group-d");
  for (const [position, name] of [[0, "syllabus"], [1, "quizzes"], [2, "tests"], [3, "library"], [4, "papers"], [5, "progress"]]) {
    await page.locator(".hub-grid .info-card").nth(position).click();
    await route(page, name);
    await browserBack(page, "group-d");
  }
  await browserBack(page, "exams");
  await browserBack(page, "home");
  const denied = await page.evaluate(async () => (await fetch("/api/profile", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "selectGoal", goalExamId: "ssc-mts" }),
  })).status);
  assert.equal(denied, 400);
  checked("search, every upcoming exam, active Group D hub and server-side category lock");

  await page.locator(".dashboard-primary .section-link").first().click();
  await route(page, "syllabus");
  await page.locator(".topic-row .topic-check").first().click();
  assert.match(await page.locator(".syllabus-overview").innerText(), /% complete/);
  await page.locator(".topic-row .topic-save").first().click();
  await page.locator(".syllabus-list + .notice-strip").count();
  await page.locator(".subject-toggle").nth(1).click();
  await page.locator(".search-field input").fill("percent");
  assert.ok((await page.locator(".topic-row").count()) >= 1);
  await browserBack(page, "home");
  checked("syllabus expansion, search, completion and bookmark controls");

  await page.locator(".quick-grid .info-card").first().click();
  await route(page, "library");
  await page.locator(".document-card button").filter({ hasText: "Open" }).first().click();
  await route(page, "document-detail");
  assert.match(await page.locator(".reading-surface").innerText(), /study note/i);
  await page.getByRole("button", { name: /Bookmark/i }).click();
  await browserBack(page, "library");
  await browserBack(page, "home");
  checked("library note reading and document bookmark");

  await page.locator(".bell-button").click();
  await route(page, "notifications");
  await page.getByRole("button", { name: /Mark all as read/i }).click();
  await page.locator(".notification-item").first().click();
  await route(page, "syllabus");
  await browserBack(page, "notifications");
  await browserBack(page, "home");
  checked("notification inbox, mark all read and destination navigation");

  await page.locator(".quick-grid .info-card").nth(1).click();
  await route(page, "quizzes");
  for (const chip of ["Daily practice", "Topic-wise", "All quizzes"]) await page.locator(".filter-chips button", { hasText: chip }).click();
  await page.locator(".quiz-list-card").first().getByRole("button", { name: /Start test/i }).click();
  await route(page, "quiz-instructions");
  await page.getByRole("button", { name: /Start test/i }).click();
  await route(page, "attempt");
  await page.locator(".answer-option").nth(2).click();
  await page.getByRole("button", { name: /Mark for review/i }).click();
  await page.locator(".palette-mobile-btn").click();
  assert.equal(await page.locator(".test-palette").isVisible(), true);
  await page.evaluate(() => history.back());
  await page.locator(".test-palette").waitFor({ state: "hidden" });
  await route(page, "attempt");
  assert.equal(await page.locator(".answer-option.selected").count(), 1);
  await page.getByRole("button", { name: /Leave test/i }).click();
  await route(page, "quiz-instructions");
  await page.getByRole("button", { name: /Resume saved test/i }).click();
  await route(page, "attempt");
  await page.locator(".answer-option.selected").waitFor();
  assert.match(await page.locator(".question-actions").innerText(), /Marked for review/i);
  await page.locator(".palette-mobile-btn").click();
  await page.locator(".palette-grid button").last().click();
  assert.match(await page.locator(".test-progress").innerText(), /Question 6 of 6/i);
  await page.getByRole("button", { name: /Previous/i }).click();
  await page.getByRole("button", { name: /Save & next/i }).click();
  await page.locator(".palette-mobile-btn").click();
  await page.locator(".palette-submit").click();
  await page.getByRole("dialog").waitFor();
  await page.evaluate(() => history.back());
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await route(page, "attempt");
  assert.equal(await page.locator(".test-palette").isVisible(), true);
  await page.locator(".palette-submit").click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await route(page, "result");
  await page.getByRole("heading", { name: /Every attempt is progress/i }).waitFor();
  await page.locator(".review-toggle").first().click();
  await page.locator(".review-body").first().getByRole("button", { name: /Save question/i }).click();
  await page.locator(".result-page .back-link").click();
  await route(page, "quiz-instructions");
  await page.locator(".bottom-nav button").nth(0).click();
  await route(page, "home");
  checked("quiz answers survive immediate Back, palette/dialog close first, results and review work");

  await page.locator(".quick-grid .info-card").nth(2).click();
  await route(page, "tests");
  await page.locator(".quiz-list-card .primary-btn").first().click();
  await route(page, "quiz-instructions");
  await page.getByRole("button", { name: /Start test/i }).click();
  await route(page, "attempt");
  await page.locator(".palette-mobile-btn").click();
  await page.locator(".palette-submit").click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await route(page, "result");
  await page.locator(".result-actions button").first().click();
  await route(page, "progress");
  assert.ok((await page.locator(".history-list button").count()) >= 2);
  await page.locator(".bottom-nav button").nth(0).click();
  await route(page, "home");
  checked("mock-test submission, persisted result history and progress link");

  await page.getByRole("button", { name: "Open menu" }).click();
  await page.locator(".app-drawer").waitFor();
  await page.evaluate(() => history.back());
  await page.locator(".app-drawer").waitFor({ state: "hidden" });
  await route(page, "home");
  for (const [position, name] of [[1, "purchases"], [2, "settings"]]) {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.locator(".drawer-items button").nth(position).click();
    await route(page, name);
    await browserBack(page, "home");
  }
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.locator(".drawer-items button").nth(3).click();
  await page.locator(".app-drawer").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.locator(".drawer-items button").nth(4).click();
  await page.getByRole("status").filter({ hasText: /store listing is not available/i }).waitFor();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.locator(".drawer-items button").nth(5).click();
  await page.getByRole("dialog", { name: /Close your guest study session/i }).waitFor();
  await page.evaluate(() => history.back());
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await route(page, "home");
  checked("drawer Back, Purchases, Settings, Share, Rate and Logout confirmation");

  await page.locator(".bottom-nav button").nth(4).click();
  await route(page, "more");
  for (const [position, name] of [[0, "profile"], [1, "settings"], [2, "bookmarks"], [3, "purchases"], [4, "help"]]) {
    await page.locator(".more-list button").nth(position).click();
    await route(page, name);
    await browserBack(page, "more");
  }
  await page.locator(".more-list button").nth(5).click();
  await page.locator(".more-list button").nth(6).click();
  await page.getByRole("status").filter({ hasText: /store listing is not available/i }).waitFor();
  await page.locator(".more-profile button").click();
  await route(page, "profile");
  await page.locator("#profile-name").fill("Navigation Tester");
  await page.locator("#profile-email").fill("navigation@example.test");
  await page.locator("#profile-state").selectOption("Bihar");
  await page.getByRole("button", { name: /Save changes/i }).click();
  await page.getByRole("status").filter({ hasText: /Profile updated successfully/i }).waitFor();
  await browserBack(page, "more");
  await page.locator(".more-list button").nth(1).click();
  await route(page, "settings");
  await page.getByRole("button", { name: /Enable device alerts/i }).click();
  await page.getByRole("status").filter({ hasText: /Firebase Messaging setup/i }).waitFor();
  await page.locator(".settings-group select").selectOption("en");
  await page.getByRole("status").filter({ hasText: /Preferences saved/i }).waitFor();
  await page.locator(".settings-group button").filter({ hasText: "Privacy Policy" }).click();
  await route(page, "privacy");
  await browserBack(page, "settings");
  await page.locator(".settings-group button").filter({ hasText: "Terms & Conditions" }).click();
  await route(page, "terms");
  await browserBack(page, "settings");
  await page.locator(".settings-group button").filter({ hasText: "Help & Support" }).click();
  await route(page, "help");
  await browserBack(page, "settings");
  await page.locator(".bottom-nav button").nth(0).click();
  await route(page, "home");
  assert.match(await page.locator(".greeting-row h1").innerText(), /Navigation Tester/);
  checked("More actions, profile persistence, settings, preference and legal navigation");
  await page.locator(".bottom-nav button").nth(4).click();
  await route(page, "more");
  await page.locator(".logout-row").click();
  await page.getByRole("dialog").getByRole("button", { name: "Close session" }).click();
  await page.getByRole("button", { name: "Open for Study", exact: true }).waitFor();
  const afterLogout = await page.evaluate(async () => (await fetch("/api/bootstrap")).json());
  assert.equal(afterLogout.authenticated, false);
  assert.equal((await db.select().from(testUsers).where(eq(testUsers.id, data.user.id))).length, 0);
  checked("guest sign-out returns to welcome and removes its unlinked study data");
  await context.close();
}

async function desktopFlow() {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, extraHTTPHeaders: testHeaders() });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => pageErrors.push(`desktop: ${error.message}`));
  await openStudy(page);
  const targets = ["home", "my-courses", "quizzes", "tests", "syllabus", "library", "progress", "bookmarks", "papers", "job-alerts", "settings"];
  for (const target of targets.slice(1)) {
    await page.locator(".desktop-sidebar .sidebar-link").filter({ hasText: new RegExp(target === "my-courses" ? "मेरे कोर्स" : target === "quizzes" ? "डेली क्विज़" : target === "tests" ? "मॉक टेस्ट" : target === "syllabus" ? "पाठ्यक्रम" : target === "library" ? "मेरी लाइब्रेरी" : target === "progress" ? "मेरी प्रगति" : target === "bookmarks" ? "सहेजी गई सामग्री" : target === "papers" ? "पिछले प्रश्न पत्र" : target === "job-alerts" ? "नौकरी सूचना" : "सेटिंग्स") }).first().click();
    await route(page, target);
    await browserBack(page, "home");
  }
  await page.locator(".desktop-sidebar .sidebar-help button").click();
  await route(page, "help");
  await browserBack(page, "home");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.locator(".drawer-items button").first().click();
  await route(page, "home");
  assert.equal(await page.locator(".app-drawer").count(), 0);
  checked("desktop sidebar items, help link and drawer Home navigation");
  await context.close();
}

async function browserExitFlow() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: testHeaders() });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  await page.goto("about:blank");
  await openStudy(page);
  await page.evaluate(() => history.back());
  await page.getByRole("status").filter({ hasText: "Press back again to exit" }).waitFor();
  await page.waitForTimeout(2100);
  await page.evaluate(() => history.back());
  await page.getByRole("status").filter({ hasText: "Press back again to exit" }).waitFor();
  await route(page, "home");
  await page.evaluate(() => history.back());
  await page.waitForURL("about:blank", { timeout: 12000 });
  checked("browser Home Back resets after two seconds and leaves web history on timely second press");
  await context.close();
}

try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  await mobileFlow();
  await desktopFlow();
  await browserExitFlow();
  assert.deepEqual(pageErrors, [], `Uncaught browser errors: ${pageErrors.join("; ")}`);
  console.log(`PASS: ${checks} navigation groups; no uncaught browser errors.`);
} finally {
  if (browser) await browser.close();
  if (createdUsers.size) {
    const ids = [...createdUsers];
    await db.delete(testSessions).where(inArray(testSessions.principalId, ids));
    await db.delete(testUsers).where(and(inArray(testUsers.id, ids), eq(testUsers.isDemo, true)));
    console.log(`Removed ${ids.length} temporary browser-test accounts.`);
  }
  await pool.end();
}
