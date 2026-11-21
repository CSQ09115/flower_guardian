import {
  ADMIN_ROUTES,
  LOGIN_ROUTE,
  VIEWPORTS,
  adminRoutes,
  adminToken,
  assert,
  gotoAdmin,
  withPage,
} from "./lib.mjs";

/** Shared per-page assertions: title, h1, layout, images. */
async function assertPage(page, { route, label, titlePart, h1Part, prefix }) {
  const title = await page.title();
  assert(
    title.includes(titlePart),
    `[smoke] ${route} @ ${label}: title ${JSON.stringify(title)} is missing ${JSON.stringify(titlePart)}`,
  );

  const heading = (await page.locator("h1").first().innerText()).replace(/\s+/g, " ").trim();
  assert(
    heading.includes(h1Part),
    `[smoke] ${route} @ ${label}: h1 ${JSON.stringify(heading)} is missing ${JSON.stringify(h1Part)}`,
  );

  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    broken: [...document.images]
      .filter((image) => image.naturalWidth === 0)
      .map((image) => image.getAttribute("src") ?? "(no src)"),
  }));

  assert(layout.overflow <= 1, `[${prefix}] ${route} @ ${label}: horizontal overflow ${layout.overflow}px`);
  assert(
    layout.broken.length === 0,
    `[${prefix}] ${route} @ ${label}: broken images ${layout.broken.join(", ")}`,
  );
}

/** Every console route (and the login screen) at desktop and mobile widths. */
export async function run(browser) {
  const token = await adminToken();
  let checked = 0;

  if (!token) {
    /* Logged out: the login screen works and every console route bounces there. */
    for (const [route] of ADMIN_ROUTES) {
      for (const [label, viewport] of Object.entries(VIEWPORTS)) {
        await withPage(
          browser,
          async (page) => {
            await gotoAdmin(page, route);
            assert(
              page.url().endsWith("#/login"),
              `[smoke] ${route} @ ${label}: expected a redirect to #/login, got ${page.url()}`,
            );
            const heading = (await page.locator("h1").first().innerText()).replace(/\s+/g, " ").trim();
            assert(heading.includes("让每一只花盆"), `[smoke] ${route} @ ${label}: login screen did not render`);
          },
          viewport,
        );
        checked += 1;
      }
    }

    for (const [label, viewport] of Object.entries(VIEWPORTS)) {
      await withPage(
        browser,
        async (page) => {
          await gotoAdmin(page, LOGIN_ROUTE[0]);
          await assertPage(page, {
            route: LOGIN_ROUTE[0],
            label,
            titlePart: LOGIN_ROUTE[1],
            h1Part: LOGIN_ROUTE[2],
            prefix: "smoke",
          });
        },
        viewport,
      );
      checked += 1;
    }

    console.log(
      `smoke: ${checked} route/viewport combinations passed (logged out: ${ADMIN_ROUTES.length} routes redirected to #/login)`,
    );
    return;
  }

  for (const [route, titlePart, h1Part] of adminRoutes()) {
    for (const [label, viewport] of Object.entries(VIEWPORTS)) {
      await withPage(
        browser,
        async (page) => {
          await gotoAdmin(page, route);
          assert(
            !page.url().endsWith("#/login"),
            `[smoke] ${route} @ ${label}: session was rejected — is the token valid?`,
          );
          await assertPage(page, { route, label, titlePart, h1Part, prefix: "smoke" });
        },
        viewport,
        { token },
      );
      checked += 1;
    }
  }

  console.log(`smoke: ${checked} route/viewport combinations passed (logged in)`);
}