import AxeBuilder from "@axe-core/playwright";
import { LOGIN_ROUTE, VIEWPORTS, adminRoutes, adminToken, assert, gotoAdmin, withPage } from "./lib.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** axe-core AA on the login screen and, when logged in, every console route. */
export async function run(browser) {
  const token = await adminToken();
  const routes = token ? adminRoutes() : [LOGIN_ROUTE];
  let checked = 0;

  for (const [route] of routes) {
    for (const [label, viewport] of Object.entries(VIEWPORTS)) {
      await withPage(
        browser,
        async (page) => {
          await gotoAdmin(page, route);
          const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

          if (results.violations.length > 0) {
            const detail = results.violations
              .map((violation) => {
                const nodes = violation.nodes
                  .map((node) => `    ${node.target.join(" ")}\n      ${node.html}`)
                  .join("\n");
                return `  ${violation.id} (${violation.impact}): ${violation.help}\n${nodes}`;
              })
              .join("\n");
            assert(
              false,
              `[a11y] ${route} @ ${label}: ${results.violations.length} violation(s)\n${detail}`,
            );
          }
        },
        viewport,
        token ? { token } : {},
      );
      checked += 1;
    }
  }

  const mode = token ? "logged in" : "logged out";
  console.log(`a11y: ${checked} route/viewport combinations passed (${mode}, axe ${TAGS.join(", ")})`);
}