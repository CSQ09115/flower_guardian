import { ROUTES, VIEWPORTS, assert, gotoAdmin, withPage } from "./lib.mjs";

/** Every admin route, at desktop and mobile widths: title, h1, layout, images. */
export async function run(browser) {
  let checked = 0;

  for (const [route, titlePart, h1Part] of ROUTES) {
    for (const [label, viewport] of Object.entries(VIEWPORTS)) {
      await withPage(
        browser,
        async (page) => {
          await gotoAdmin(page, route);

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

          assert(
            layout.overflow <= 1,
            `[smoke] ${route} @ ${label}: horizontal overflow ${layout.overflow}px`,
          );
          assert(
            layout.broken.length === 0,
            `[smoke] ${route} @ ${label}: broken images ${layout.broken.join(", ")}`,
          );
        },
        viewport,
      );
      checked += 1;
    }
  }

  console.log(`smoke: ${checked} route/viewport combinations passed`);
}