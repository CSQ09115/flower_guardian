import { renderToString } from "react-dom/server";
import { SiteApp } from "./App";

/**
 * Server entry used by `scripts/prerender.mjs`. Styles stay out of this module
 * on purpose: Vite handles the CSS import in `main.tsx`, and the prerender only
 * needs the markup string.
 */
export function renderSite(): string {
  return renderToString(<SiteApp />);
}