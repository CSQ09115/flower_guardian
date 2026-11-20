import { useCallback, useEffect, useRef, useState } from "react";
import { finderNote, rankPlants } from "../data/finder";
import type { FinderAnswers, RankedPlant } from "../data/finder";

export type FinderResult = { top: RankedPlant; alts: RankedPlant[]; note: string };

const KEYS = ["light", "time", "pets"] as const;

/**
 * Three-step plant finder. Mirrors the legacy flow: picking an option locks the
 * step for 170ms, then advances; the third pick ranks the library and replaces
 * the questions with the result. All state starts deterministic (step 1, empty
 * answers) so prerender and first client render agree.
 */
export function useFinder(): {
  step: number;
  answers: FinderAnswers;
  picks: Partial<Record<number, string>>;
  busy: boolean;
  done: boolean;
  result: FinderResult | null;
  pick: (value: string) => void;
  restart: () => void;
} {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<FinderAnswers>({});
  const [picks, setPicks] = useState<Partial<Record<number, string>>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FinderResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const pick = useCallback(
    (value: string): void => {
      if (busy) return;
      setBusy(true);
      setPicks((previous) => ({ ...previous, [step]: value }));

      const nextAnswers: FinderAnswers = { ...answers, [KEYS[step]]: value };
      setAnswers(nextAnswers);

      timer.current = setTimeout(() => {
        setBusy(false);
        if (step < KEYS.length - 1) {
          setStep(step + 1);
        } else {
          const ranked = rankPlants(nextAnswers);
          setResult({ top: ranked[0], alts: ranked.slice(1, 3), note: finderNote(nextAnswers) });
        }
      }, 170);
    },
    [answers, busy, step],
  );

  const restart = useCallback((): void => {
    if (timer.current) clearTimeout(timer.current);
    setBusy(false);
    setAnswers({});
    setPicks({});
    setResult(null);
    setStep(0);
  }, []);

  return { step, answers, picks, busy, done: result !== null, result, pick, restart };
}