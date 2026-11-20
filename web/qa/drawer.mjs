import { VIEWPORTS, assert, gotoAdmin, withPage } from "./lib.mjs";

const state = (page) =>
  page.evaluate(() => {
    const sidebar = document.querySelector(".sidebar");
    const main = document.querySelector(".main");
    const toggle = document.querySelector("#menu-toggle");
    return {
      open: sidebar.classList.contains("is-open"),
      x: Math.round(sidebar.getBoundingClientRect().x),
      inert: main.hasAttribute("inert") && main.inert === true,
      expanded: toggle.getAttribute("aria-expanded"),
      focusId: document.activeElement?.id ?? "",
      focusInSidebar: Boolean(document.activeElement?.closest(".sidebar")),
      focusInMain: Boolean(document.activeElement?.closest(".main")),
    };
  });

/** Mobile drawer: open, focus trap through `inert`, Escape, breakpoint close. */
export async function run(browser) {
  await withPage(
    browser,
    async (page) => {
      await gotoAdmin(page, "overview");

      await page.click("#menu-toggle");
      await page.waitForFunction(() => {
        const sidebar = document.querySelector(".sidebar");
        return sidebar.classList.contains("is-open") && getComputedStyle(sidebar).transform === "none";
      });
      const opened = await state(page);
      assert(opened.open, "[drawer] sidebar did not open");
      assert(opened.x === 0, `[drawer] sidebar is not on screen (x=${opened.x})`);
      assert(opened.inert, "[drawer] .main is not inert while the drawer is open");
      assert(opened.expanded === "true", "[drawer] menu button is not aria-expanded");
      assert(opened.focusInSidebar, "[drawer] focus did not move into the sidebar");

      for (let index = 0; index < 10; index += 1) {
        await page.keyboard.press("Tab");
        const current = await state(page);
        assert(
          current.focusId !== "refresh",
          "[drawer] Tab reached #refresh behind the drawer",
        );
        assert(!current.focusInMain, "[drawer] Tab reached an element inside inert .main");
      }

      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector(".sidebar").classList.contains("is-open"));
      const closed = await state(page);
      assert(!closed.open, "[drawer] Escape did not close the sidebar");
      assert(!closed.inert, "[drawer] .main is still inert after closing");
      assert(
        closed.focusId === "menu-toggle",
        `[drawer] focus was not restored to #menu-toggle (got ${closed.focusId || "nothing"})`,
      );

      await page.click("#menu-toggle");
      await page.waitForFunction(() => document.querySelector(".sidebar").classList.contains("is-open"));
      await page.setViewportSize({ width: 1200, height: 900 });
      await page.waitForFunction(() => !document.querySelector(".sidebar").classList.contains("is-open"));
      const resized = await state(page);
      assert(!resized.open, "[drawer] sidebar stayed open after crossing 981px");
      assert(resized.expanded === "false", "[drawer] menu button stayed aria-expanded after resize");
      assert(!resized.inert, "[drawer] .main stayed inert after resize");
    },
    VIEWPORTS.mobile,
  );

  console.log("drawer: open, inert focus guard, Escape and breakpoint close passed");
}