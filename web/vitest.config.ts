/* Vitest 配置（Task 4）。

   计划里的写法是从 `"vitest/config"` 导入 `defineConfig`。本仓库装的是
   vitest 2.1.9，它的类型链会引到 `chai@5`——该包不带 .d.ts，仓库也没有
   `@types/chai`；而 `tsconfig.node.json` 没有开 `skipLibCheck`，所以
   `npm run typecheck` 会报 TS7016（`node_modules/vitest/dist/chunks/*.d.ts`）。

   运行时 `defineConfig` 只是一个恒等函数，因此这里导出等价的普通对象，
   配置项与计划完全一致：`environment: "node"`，include 只收
   `src` 目录下的 `.test.ts` 文件。 */

type AdminVitestConfig = {
  test: {
    environment: string;
    include: string[];
  };
};

export default {
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
} satisfies AdminVitestConfig;
