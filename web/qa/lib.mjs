/**
 * Shared helpers for the Playwright QA suite.
 *
 * The suite talks to the built site through `vite preview` on port 4177, so
 * every assertion runs against the same artifact that ships in `dist/`.
 */

export const BASE = "http://127.0.0.1:4177";

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

/** [hash route, <title> fragment, <h1> fragment] — mirrors the admin route table. */
export const ROUTES = [
  ["overview", "概览", "概览"],
  ["stats", "数据统计", "数据统计"],
  ["devices", "花盆设备", "花盆设备"],
  ["devices/FG-ESP32-001", "设备详情", "客厅 · 绿萝"],
  ["alerts", "告警记录", "告警记录"],
  ["products", "商品管理", "商品管理"],
  ["orders", "订单管理", "订单管理"],
  ["users", "用户管理", "用户管理"],
  ["plants", "植物库", "植物库"],
  ["login", "登录", "让每一只花盆"],
];

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Waits until the routed view (or the login screen) has painted and settled. */
export async function settle(page) {
  await page.waitForFunction(() => {
    const view = document.querySelector("#view");
    return Boolean((view && view.children.length > 0) || document.querySelector(".login"));
  });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  /* Entrance animations fade text in; axe must not sample a semi-transparent frame. */
  await page.evaluate(async () => {
    const running = document
      .getAnimations({ subtree: true })
      .filter((animation) => animation.playState === "running");
    await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
  });
}

export async function gotoAdmin(page, route) {
  await page.goto(`${BASE}/admin/#/${route}`, { waitUntil: "networkidle" });
  await settle(page);
}

/**
 * Runs `fn` in a fresh context. Console errors and uncaught page errors are
 * collected and fail the test unless `fn` already asserted something earlier.
 */
export async function withPage(browser, fn, viewport = VIEWPORTS.desktop, options = {}) {
  const { init, ...contextOptions } = options;
  const context = await browser.newContext({ viewport, ...contextOptions });
  const page = await context.newPage();
  if (init) await page.addInitScript(init);

  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

  try {
    await fn(page, errors);
    assert(errors.length === 0, `browser errors:\n${errors.join("\n")}`);
  } finally {
    await context.close();
  }
}