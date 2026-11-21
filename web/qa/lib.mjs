/**
 * Shared helpers for the Playwright QA suite.
 *
 * The suite talks to the built site through `vite preview` on port 4177, so
 * every assertion runs against the same artifact that ships in `dist/`.
 *
 * The console only renders PostgreSQL-backed data behind a login, so the suite
 * has two modes:
 *  - without `QA_ADMIN_USER` / `QA_ADMIN_PASSWORD`: verify the login screen and
 *    that every console route redirects to it;
 *  - with both variables: log in through the API, seed the token into
 *    `localStorage`, and run the console assertions as an administrator.
 */

export const BASE = "http://127.0.0.1:4177";
export const API_BASE = process.env.QA_API_BASE ?? "http://localhost:8000";
export const TOKEN_KEY = "fg_admin_token";

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

/** [hash route, <title> fragment, <h1> fragment] */
export const LOGIN_ROUTE = ["login", "登录", "让每一只花盆"];

export const ADMIN_ROUTES = [
  ["overview", "概览", "概览"],
  ["stats", "数据统计", "数据统计"],
  ["devices", "花盆设备", "花盆设备"],
  ["alerts", "告警记录", "告警记录"],
  ["products", "商品管理", "商品管理"],
  ["orders", "订单管理", "订单管理"],
  ["users", "用户管理", "用户管理"],
  ["plants", "植物库", "植物库"],
];

/**
 * Console routes for the current run. The device detail page needs a real
 * device row, so it is only exercised when the caller names one.
 */
export function adminRoutes() {
  const code = process.env.QA_DEVICE_CODE;
  const name = process.env.QA_DEVICE_NAME;
  if (!code || !name) return ADMIN_ROUTES;
  return [...ADMIN_ROUTES, [`devices/${code}`, "设备详情", name]];
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let cachedToken = null;

/**
 * Logs in through the API and returns the access token, or `null` when the
 * credentials were not supplied. The token is what the console stores after a
 * successful login, so seeding it into `localStorage` is the same state.
 */
export async function adminToken() {
  const username = process.env.QA_ADMIN_USER;
  const password = process.env.QA_ADMIN_PASSWORD;
  if (!username || !password) return null;
  if (cachedToken) return cachedToken;
  const response = await fetch(`${API_BASE}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
  });
  if (!response.ok) {
    throw new Error(`[qa] login failed (${response.status}) at ${API_BASE}`);
  }
  const payload = await response.json();
  if (!payload?.access_token) {
    throw new Error("[qa] login response is missing access_token");
  }
  cachedToken = payload.access_token;
  return cachedToken;
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
 *
 * `options.token` seeds the console session before the first paint, so the
 * route guard sees a logged-in visitor.
 */
export async function withPage(browser, fn, viewport = VIEWPORTS.desktop, options = {}) {
  const { init, token, ...contextOptions } = options;
  const context = await browser.newContext({ viewport, ...contextOptions });
  const page = await context.newPage();
  if (init) await page.addInitScript(init);
  if (token) {
    await page.addInitScript(
      ({ key, value }) => {
        try {
          localStorage.setItem(key, value);
        } catch {
          /* storage disabled: the route guard will send us to /login */
        }
      },
      { key: TOKEN_KEY, value: token },
    );
  }

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