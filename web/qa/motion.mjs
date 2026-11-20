import { BASE, assert, gotoAdmin, withPage } from "./lib.mjs";

const animations = (page) =>
  page.evaluate(() => {
    const all = document.getAnimations({ subtree: true });
    return {
      total: all.length,
      running: all.filter((animation) => animation.playState === "running").length,
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  });

/** Reduced motion must stop every animation; the default context must still animate. */
export async function run(browser) {
  await withPage(browser, async (page) => {
    await gotoAdmin(page, "overview");
    await page.waitForTimeout(200);
    const state = await animations(page);
    assert(state.reduced, "[motion] reduced-motion media query is not active");
    assert(
      state.running === 0,
      `[motion] ${state.running} animation(s) still running with reduced motion (${state.total} tracked)`,
    );
  }, undefined, { reducedMotion: "reduce" });

  await withPage(browser, async (page) => {
    await page.goto(`${BASE}/admin/#/overview`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#view h1");
    await page.waitForFunction(() => document.querySelector(".view").classList.contains("is-enter"));
    const state = await page.evaluate(() => {
      const all = document.getAnimations({ subtree: true });
      return {
        total: all.length,
        running: all.filter((animation) => animation.playState === "running").length,
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      };
    });
    assert(!state.reduced, "[motion] default context reports reduced motion");
    assert(
      state.running > 0,
      `[motion] no animation is running in the default context (${state.total} tracked) — the reduced-motion assertion would be vacuous`,
    );
  });

  console.log("motion: reduced motion stops animations; default context still animates");
}