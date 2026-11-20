import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { BASE } from "./lib.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SUITES = ["smoke", "a11y", "drawer", "motion", "site"];

function runNpm(args) {
  const npm = process.env.npm_execpath;
  if (npm) {
    execFileSync(process.execPath, [npm, ...args], { cwd: ROOT, stdio: "inherit", env: process.env });
    return;
  }
  execFileSync("npm", args, { cwd: ROOT, stdio: "inherit", env: process.env });
}

async function isPortBusy() {
  try {
    await fetch(BASE, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(preview, readLog) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (preview.exitCode !== null) {
      throw new Error(`preview exited with code ${preview.exitCode}\n${readLog()}`);
    }
    try {
      const response = await fetch(BASE, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      /* not listening yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`preview server did not answer on ${BASE} within 30s\n${readLog()}`);
}

/**
 * Uses the browser Playwright manages. If that revision is not downloaded (for
 * example an offline machine with an older cache), falls back to the newest
 * headless shell already present, and accepts an explicit `CHROMIUM_PATH`.
 */
function cachedChromium() {
  const cacheRoots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.platform === "darwin" ? join(homedir(), "Library/Caches/ms-playwright") : null,
    process.platform === "win32" ? join(process.env.LOCALAPPDATA ?? homedir(), "ms-playwright") : null,
    join(homedir(), ".cache/ms-playwright"),
  ].filter(Boolean);

  const platformDir =
    process.platform === "darwin"
      ? process.arch === "arm64"
        ? "chrome-headless-shell-mac-arm64"
        : "chrome-headless-shell-mac-x64"
      : process.platform === "win32"
        ? "chrome-headless-shell-win64"
        : "chrome-headless-shell-linux64";
  const executable = process.platform === "win32" ? "chrome-headless-shell.exe" : "chrome-headless-shell";

  for (const root of cacheRoots) {
    if (!existsSync(root)) continue;
    const revisions = readdirSync(root)
      .filter((entry) => entry.startsWith("chromium_headless_shell-"))
      .sort()
      .reverse();
    for (const revision of revisions) {
      const candidate = join(root, revision, platformDir, executable);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (error) {
    const fallback = process.env.CHROMIUM_PATH || cachedChromium();
    if (!fallback) {
      throw new Error(
        `${error.message}\nInstall the matching browser with: npx playwright install chromium`,
      );
    }
    console.warn(`qa: managed browser unavailable, using cached build at ${fallback}`);
    return chromium.launch({ executablePath: fallback });
  }
}

if (await isPortBusy()) {
  throw new Error(
    `port 4177 is already in use — stop the running dev/preview server before npm run qa (${BASE})`,
  );
}

console.log("qa: building dist/ …");
runNpm(["run", "build"]);

const vite = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const preview = spawn(
  process.execPath,
  [vite, "preview", "--port", "4177", "--strictPort"],
  { cwd: ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"] },
);

let log = "";
preview.stdout.on("data", (chunk) => {
  log += chunk;
  process.stdout.write(chunk);
});
preview.stderr.on("data", (chunk) => {
  log += chunk;
  process.stderr.write(chunk);
});

let browser;
const failures = [];
try {
  await waitForServer(preview, () => log);

  browser = await launchBrowser();

  for (const name of SUITES) {
    const started = Date.now();
    try {
      const suite = await import(new URL(`./${name}.mjs`, import.meta.url));
      await suite.run(browser);
      console.log(`qa: ${name} ok (${Date.now() - started}ms)`);
    } catch (error) {
      failures.push(name);
      console.error(`\nqa: ${name} FAILED\n${error.stack || error}\n`);
    }
  }
} finally {
  await browser?.close();
  preview.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => preview.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (preview.exitCode === null) preview.kill("SIGKILL");
}

if (failures.length > 0) {
  console.error(`qa: ${failures.length} suite(s) failed: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("qa: all suites passed");
}