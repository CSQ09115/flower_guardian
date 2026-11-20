import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "vite";

/**
 * Injects the marketing page markup into the built `dist/index.html`.
 *
 * The admin entry stays client-rendered: only `dist/index.html` is touched, so
 * `dist/admin/index.html` keeps its empty `#root`. Re-running the script would
 * fail on purpose — the placeholder check keeps the build honest instead of
 * nesting a second copy of the page.
 */
const file = new URL("../dist/index.html", import.meta.url);
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });

try {
  const { renderSite } = await vite.ssrLoadModule("/src/site/entry-server.tsx");
  const html = renderSite();
  const source = await readFile(file, "utf8");

  if (!source.includes('<div id="root"></div>')) {
    throw new Error("prerender: #root placeholder not found in dist/index.html");
  }

  await writeFile(file, source.replace('<div id="root"></div>', `<div id="root">${html}</div>`));
} finally {
  await vite.close();
}