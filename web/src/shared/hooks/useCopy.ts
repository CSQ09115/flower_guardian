import { useCallback } from "react";

/**
 * Port of the marketing page's `copyText()` (legacy `assets/app.js`).
 *
 * Clipboard API first, `<textarea>` + `execCommand("copy")` fallback, and the
 * same rejection on failure so callers can show the manual-copy box. No DOM is
 * touched at module scope, so the site's prerender can import this file.
 */
function copyText(text: string): Promise<void> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("copy unavailable"));
  }

  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    return navigator.clipboard.writeText(text);
  }

  return new Promise<void>((resolve, reject) => {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-200px";
    document.body.appendChild(area);
    area.select();

    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }

    document.body.removeChild(area);
    if (ok) resolve();
    else reject(new Error("copy blocked"));
  });
}

/**
 * Returns the copy action itself (`() => Promise<void>`), so components can drop
 * it straight into an onClick handler. `source` is either the text to copy or a
 * getter for text that is built from live form state at click time.
 */
export function useCopy(source: string | (() => string) = ""): () => Promise<void> {
  return useCallback(() => {
    const text = typeof source === "function" ? source() : source;
    return copyText(text);
  }, [source]);
}
