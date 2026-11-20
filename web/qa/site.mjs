import { BASE, VIEWPORTS, assert, withPage } from "./lib.mjs";

const CARE = {
  pothos: "绿萝",
  monstera: "龟背竹",
  snake: "虎皮兰",
  peace: "白掌",
  aloe: "芦荟",
  ivy: "常春藤",
};

const APPLICATION = [
  "护花使者内测申请",
  "植物：窗边的测试绿萝",
  "摆放位置：北卧室",
  "想装的系统：Android",
].join("\n");

async function open(page) {
  await page.goto(`${BASE}/?snap`, { waitUntil: "networkidle" });
  await page.waitForSelector("#hero-title");
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
}

async function checkCareTabs(page) {
  for (const [key, name] of Object.entries(CARE)) {
    await page.click(`#tab-${key}`);
    const state = await page.evaluate((plantKey) => {
      const active = document.querySelector(".tab.is-active");
      return {
        name: document.querySelector("#care-name").textContent.trim(),
        selected: [...document.querySelectorAll(".tab")].filter(
          (tab) => tab.getAttribute("aria-selected") === "true",
        ).length,
        activeId: active?.id,
        expectedId: `tab-${plantKey}`,
        labelledBy: document.querySelector("#care-panel").getAttribute("aria-labelledby"),
        tabIndex: [...document.querySelectorAll(".tab")].map((tab) => tab.getAttribute("tabindex")),
      };
    }, key);

    assert(state.name === name, `[site] care tab ${key}: name ${JSON.stringify(state.name)} !== ${name}`);
    assert(
      state.selected === 1 && state.activeId === state.expectedId,
      `[site] care tab ${key}: active state is not exclusive (${state.activeId} selected ${state.selected})`,
    );
    assert(
      state.labelledBy === state.expectedId,
      `[site] care tab ${key}: panel is labelled by ${state.labelledBy}`,
    );
    assert(
      state.tabIndex.filter((value) => value === "0").length === 1,
      `[site] care tab ${key}: roving tabindex is broken (${state.tabIndex.join(",")})`,
    );
  }

  await page.focus("#tab-ivy");
  const presses = [
    ["ArrowRight", "pothos"],
    ["End", "ivy"],
    ["Home", "pothos"],
    ["ArrowLeft", "ivy"],
  ];
  for (const [key, expected] of presses) {
    await page.keyboard.press(key);
    const focused = await page.evaluate(() => document.activeElement?.id);
    const selected = await page.$eval(`#tab-${expected}`, (tab) => tab.getAttribute("aria-selected"));
    assert(focused === `tab-${expected}`, `[site] care keyboard ${key}: focus moved to ${focused}`);
    assert(selected === "true", `[site] care keyboard ${key}: ${expected} is not selected`);
  }
}

async function checkFinder(page) {
  await page.click('.finder__step[data-step="0"] .opt[data-value="low"]');
  await page.waitForSelector('.finder__step[data-step="1"]:not([hidden])');
  await page.click('.finder__step[data-step="1"] .opt[data-value="often"]');
  await page.waitForSelector('.finder__step[data-step="2"]:not([hidden])');
  await page.click('.finder__step[data-step="2"] .opt[data-value="no"]');
  await page.waitForSelector("#finder-result:not([hidden])");

  const result = await page.evaluate(() => ({
    name: document.querySelector("#result-name").textContent.trim(),
    step: document.querySelector("#finder-step").textContent.trim(),
    progress: document.querySelector("#finder-progress").style.width,
    alternatives: [...document.querySelectorAll("#result-alts .alt")].map((alt) =>
      alt.querySelector("b").textContent.trim(),
    ),
    hintHidden: document.querySelector("#finder-hint").hidden,
  }));

  assert(result.name === "绿萝", `[site] finder: picked ${JSON.stringify(result.name)} instead of 绿萝`);
  assert(result.step === "3 / 3", `[site] finder: step reads ${result.step}`);
  assert(result.progress === "100%", `[site] finder: progress reads ${result.progress}`);
  assert(result.alternatives.length === 2, `[site] finder: ${result.alternatives.length} alternatives`);
  assert(result.hintHidden, "[site] finder: hint is still visible after the result");

  await page.click("#finder-restart");
  await page.waitForSelector('.finder__step[data-step="0"]:not([hidden])');
  const restarted = await page.evaluate(() => ({
    step: document.querySelector("#finder-step").textContent.trim(),
    hidden: document.querySelector("#finder-result").hidden,
    picked: document.querySelectorAll(".opt.is-picked").length,
  }));
  assert(restarted.step === "1 / 3", `[site] finder restart: step reads ${restarted.step}`);
  assert(restarted.hidden, "[site] finder restart: result is still visible");
  assert(restarted.picked === 0, "[site] finder restart: a previous choice is still highlighted");
}

async function checkNav(page) {
  await page.click(".nav__toggle");
  await page.waitForFunction(() => document.querySelector("#nav").classList.contains("is-open"));
  let nav = await page.evaluate(() => ({
    open: document.querySelector("#nav").classList.contains("is-open"),
    expanded: document.querySelector(".nav__toggle").getAttribute("aria-expanded"),
    label: document.querySelector(".nav__toggle").getAttribute("aria-label"),
  }));
  assert(nav.open && nav.expanded === "true" && nav.label === "关闭菜单", "[site] nav: did not open");

  await page.click('#nav a[href="#card"]');
  await page.waitForFunction(() => !document.querySelector("#nav").classList.contains("is-open"));
  nav = await page.evaluate(() => ({
    open: document.querySelector("#nav").classList.contains("is-open"),
    expanded: document.querySelector(".nav__toggle").getAttribute("aria-expanded"),
    label: document.querySelector(".nav__toggle").getAttribute("aria-label"),
  }));
  assert(!nav.open && nav.expanded === "false" && nav.label === "打开菜单", "[site] nav: link did not close it");

  await page.click(".nav__toggle");
  await page.waitForFunction(() => document.querySelector("#nav").classList.contains("is-open"));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("#nav").classList.contains("is-open"));

  await page.click(".nav__toggle");
  await page.waitForFunction(() => document.querySelector("#nav").classList.contains("is-open"));
  await page.mouse.click(200, 780);
  await page.waitForFunction(() => !document.querySelector("#nav").classList.contains("is-open"));
}

/** Marketing page: prerender, nav, care card, finder, FAQ, copy, reveal. */
export async function run(browser) {
  /* Prerendered HTML is the whole page when scripts are off. */
  await withPage(
    browser,
    async (page) => {
      await page.goto(BASE, { waitUntil: "load" });
      const noJs = await page.evaluate(() => ({
        hero: document.querySelector("#hero-title")?.textContent.replace(/\s+/g, ""),
        opacity: getComputedStyle(document.querySelector(".hero h1")).opacity,
        faq: document.querySelectorAll("#faq details").length,
        icons: document.querySelectorAll("svg.reicon").length,
        care: document.querySelector("#care-name")?.textContent.trim(),
      }));
      assert(noJs.hero === "让养花不再凭感觉", `[site] no-js: hero reads ${JSON.stringify(noJs.hero)}`);
      assert(noJs.opacity === "1", `[site] no-js: hero opacity is ${noJs.opacity}`);
      assert(noJs.faq === 6, `[site] no-js: ${noJs.faq} FAQ entries`);
      assert(noJs.icons > 40, `[site] no-js: only ${noJs.icons} icons prerendered`);
      assert(noJs.care === "绿萝", `[site] no-js: care card reads ${JSON.stringify(noJs.care)}`);
    },
    VIEWPORTS.desktop,
    { javaScriptEnabled: false },
  );

  for (const [label, viewport] of Object.entries(VIEWPORTS)) {
    await withPage(
      browser,
      async (page) => {
        await open(page);

        const layout = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          broken: [...document.images]
            .filter((image) => image.naturalWidth === 0)
            .map((image) => image.getAttribute("src") ?? "(no src)"),
        }));
        assert(layout.overflow <= 1, `[site] ${label}: horizontal overflow ${layout.overflow}px`);
        assert(layout.broken.length === 0, `[site] ${label}: broken images ${layout.broken.join(", ")}`);

        if (viewport.width < 981) await checkNav(page);
        await checkCareTabs(page);
        await checkFinder(page);

        const secondFaq = page.locator("#faq details").nth(1);
        await secondFaq.locator("summary").click();
        assert(await secondFaq.evaluate((details) => details.open), "[site] FAQ: detail did not open");
      },
      viewport,
    );
  }

  /* Clipboard success path. */
  await withPage(
    browser,
    async (page) => {
      await open(page);
      await page.fill("#plant-nickname", "窗边的测试绿萝");
      await page.click('.seg label:has-text("北卧室")');
      await page.selectOption("#plant-os", "Android");
      await page.click("#beta-submit");
      await page.waitForFunction(() =>
        document.querySelector("#beta-submit").classList.contains("is-copied"),
      );
      const state = await page.evaluate(async () => ({
        label: document.querySelector("#beta-submit .btn__text").textContent.trim(),
        note: document.querySelector("#beta-note").textContent.trim(),
        status: document.querySelector("#beta-status").textContent.trim(),
        clipboard: await navigator.clipboard.readText(),
      }));
      assert(state.label === "已复制", `[site] copy: button reads ${JSON.stringify(state.label)}`);
      assert(state.clipboard === APPLICATION, "[site] copy: clipboard text differs");
      assert(state.note.includes("已复制"), `[site] copy: note reads ${JSON.stringify(state.note)}`);
      assert(state.status.includes("已复制"), `[site] copy: status reads ${JSON.stringify(state.status)}`);
    },
    VIEWPORTS.desktop,
    { permissions: ["clipboard-read", "clipboard-write"] },
  );

  /* Clipboard blocked: the fallback textarea appears, focused and selected. */
  await withPage(
    browser,
    async (page) => {
      await open(page);
      await page.fill("#plant-nickname", "窗边的测试绿萝");
      await page.click('.seg label:has-text("北卧室")');
      await page.selectOption("#plant-os", "Android");
      await page.click("#beta-submit");
      await page.waitForSelector("#beta-manual");

      const state = await page.evaluate(() => {
        const manual = document.querySelector("#beta-manual");
        return {
          value: manual.value,
          focused: document.activeElement === manual,
          selected: manual.selectionStart === 0 && manual.selectionEnd === manual.value.length,
          note: document.querySelector("#beta-note").textContent.trim(),
          status: document.querySelector("#beta-status").textContent.trim(),
          copied: document.querySelector("#beta-submit").classList.contains("is-copied"),
        };
      });
      assert(state.value === APPLICATION, "[site] copy fallback: textarea text differs");
      assert(state.focused, "[site] copy fallback: textarea is not focused");
      assert(state.selected, "[site] copy fallback: textarea is not fully selected");
      assert(!state.copied, "[site] copy fallback: button claims success");
      assert(state.note.includes("手动复制"), `[site] copy fallback: note reads ${JSON.stringify(state.note)}`);
      assert(state.status.includes("选中"), `[site] copy fallback: status reads ${JSON.stringify(state.status)}`);
    },
    VIEWPORTS.desktop,
    {
      init: () => {
        Object.defineProperty(navigator, "clipboard", { configurable: true, get: () => undefined });
        document.execCommand = () => false;
      },
    },
  );

  /* Scroll reveals: hidden until observed, then progressively added. */
  await withPage(browser, async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => document.querySelectorAll(".reveal.in").length);
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      document.querySelector("#spec").scrollIntoView();
    });
    await page.waitForFunction((count) => document.querySelectorAll(".reveal.in").length > count, before);
    const after = await page.evaluate(() => document.querySelectorAll(".reveal.in").length);
    assert(after > before, `[site] reveal: count stayed at ${after}`);
  });

  console.log("site: prerender, nav, care tabs, finder, FAQ, copy and reveal passed");
}