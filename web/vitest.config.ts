/* Vitest 配置（Task 4）。

   与计划一致：`environment: "node"`，只收 `src` 目录下的 `.test.ts`。
   `tsconfig.node.json` 需要 `skipLibCheck`（与 `tsconfig.json` 相同），否则
   vitest 2.1.9 的类型链会引到没有自带 .d.ts 的 `chai@5`。 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
