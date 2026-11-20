import { FINDER } from "./plants";
import type { FinderPlant, PlantKey } from "./plants";

/**
 * Pure scoring for the three-question finder, ported from `rankPlants()` in
 * `legacy/assets/app.js`. The legacy page kept answers in module scope; taking
 * them as an argument makes the ranking testable and prerender-safe.
 */
export type FinderAnswers = Partial<Record<"light" | "time" | "pets", string>>;

export type RankedPlant = { key: PlantKey; plant: FinderPlant; score: number };

export function rankPlants(answers: FinderAnswers): RankedPlant[] {
  return (Object.keys(FINDER) as PlantKey[])
    .map((key) => {
      const plant = FINDER[key];
      let score = 0;

      if (plant.light.indexOf(answers.light ?? "") > -1) score += 3;
      else score -= 1.5;

      if (plant.time.indexOf(answers.time ?? "") > -1) score += 2.5;
      else score -= 1;

      if (answers.pets === "yes" && (key === "snake" || key === "aloe")) score += 0.5;

      return { key, plant, score };
    })
    .sort((a, b) => b.score - a.score || a.plant.order - b.plant.order);
}

export function finderNote(answers: FinderAnswers): string {
  return answers.pets === "yes"
    ? "你家里有猫或小孩：这几种植物的资料里都建议放高一点，别让它们啃到。推荐结果不替代兽医建议。"
    : "先从一盆开始。把它放在你每天都会经过的地方，浇水这件事才不容易忘。";
}