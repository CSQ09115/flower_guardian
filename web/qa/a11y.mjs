import AxeBuilder from "@axe-core/playwright";
import { ROUTES, VIEWPORTS, assert, gotoAdmin, withPage } from "./lib.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** axe-core AA on every admin route at both widths. */
export async function run(browser) {
  let checked = 0;

  for (const [route] of ROUTES) {
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
      );
      checked += 1;
    }
  }

  console.log(`a11y: ${checked} route/viewport combinations passed (axe ${TAGS.join(", ")})`);
}