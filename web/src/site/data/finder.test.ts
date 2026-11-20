import { describe, expect, it } from "vitest";
import { finderNote, rankPlants } from "./finder";

const names = (answers: Parameters<typeof rankPlants>[0]): string[] =>
  rankPlants(answers).map((entry) => entry.plant.name);

describe("rankPlants", () => {
  it("picks 绿萝 for low light and frequent trips, with 虎皮兰 and 常春藤 as alternates", () => {
    const ranked = rankPlants({ light: "low", time: "often", pets: "no" });
    expect(ranked.map((entry) => entry.plant.name).slice(0, 3)).toEqual(["绿萝", "虎皮兰", "常春藤"]);
    expect(ranked[0].score).toBe(5.5);
  });

  it("picks 虎皮兰 first for direct light and frequent trips (order breaks the tie with 芦荟)", () => {
    expect(names({ light: "bright", time: "often", pets: "no" }).slice(0, 3)).toEqual([
      "虎皮兰",
      "芦荟",
      "绿萝",
    ]);
  });

  it("picks 白掌 first for soft light and being home daily, with 龟背竹 and 常春藤 as alternates", () => {
    expect(names({ light: "soft", time: "home", pets: "no" }).slice(0, 3)).toEqual([
      "白掌",
      "龟背竹",
      "常春藤",
    ]);
  });

  it("adds the pet bonus to 虎皮兰 and 芦荟 only", () => {
    const withoutPets = rankPlants({ light: "bright", time: "often" });
    const withPets = rankPlants({ light: "bright", time: "often", pets: "yes" });
    const byKey = (list: ReturnType<typeof rankPlants>): Record<string, number> =>
      Object.fromEntries(list.map((entry) => [entry.key, entry.score]));
    expect(byKey(withPets).snake - byKey(withoutPets).snake).toBe(0.5);
    expect(byKey(withPets).aloe - byKey(withoutPets).aloe).toBe(0.5);
    expect(byKey(withPets).pothos).toBe(byKey(withoutPets).pothos);
  });
});

describe("finderNote", () => {
  it("shows the pet warning only when pets answered yes", () => {
    expect(finderNote({ pets: "yes" })).toContain("你家里有猫或小孩");
    expect(finderNote({ pets: "no" })).toContain("先从一盆开始");
  });
});