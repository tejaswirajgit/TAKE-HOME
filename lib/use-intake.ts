"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Answers, AnswerValue, Lang } from "./intake-schema";
import { Step, firstUnanswered, isAnswered, isInferred, steps as buildSteps } from "./flow";

// When a source answer changes, an answer the app inferred from it (and the
// patient merely confirmed) is no longer trustworthy — drop it so it gets
// re-suggested from the new facts.
const DEPENDENTS: Record<string, string> = {
  menstrual_cycle: "pregnancy_related",
  products: "past_treatment_side_effects",
  procedures: "past_treatment_side_effects",
};
import { Saved, Stage, clearIntake, loadIntake, saveIntake } from "./intake-storage";

// React state over the pure flow engine: owns the answers, the current step,
// the stage (welcome → questions → review → done) and the two patient
// preferences (language, read-aloud). Autosaves after hydration.

export interface Intake {
  hydrated: boolean;
  answers: Answers;
  steps: Step[];
  index: number;
  current: Step | null;
  progress: number;
  stage: Stage;
  lang: Lang;
  readAloud: boolean;
  /** Came here from the review screen to change one answer. */
  editing: boolean;
  /** A saved, resumable intake exists (shown on the welcome). */
  saved: Saved | null;
  answer: (id: string, value: AnswerValue | undefined, advance?: boolean) => void;
  next: () => void;
  back: () => void;
  begin: () => void;
  resume: () => void;
  edit: (stepId: string) => void;
  toReview: () => void;
  finish: () => void;
  reset: () => void;
  setLang: (l: Lang) => void;
  setReadAloud: (v: boolean) => void;
}

export function useIntake(): Intake {
  const [hydrated, setHydrated] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("welcome");
  const [lang, setLang] = useState<Lang>("en");
  const [readAloud, setReadAloud] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);

  useEffect(() => {
    const s = loadIntake();
    if (s) {
      setLang(s.lang);
      setReadAloud(s.readAloud);
      if (Object.keys(s.answers).length) setSaved(s);
    }
    setHydrated(true);
  }, []);

  // Autosave — but never clobber a saved intake the patient hasn't resumed yet;
  // until they do, only the two preferences are updated on it.
  useEffect(() => {
    if (!hydrated) return;
    if (saved) saveIntake({ ...saved, lang, readAloud });
    else saveIntake({ answers, index, stage, lang, readAloud });
  }, [hydrated, saved, answers, index, stage, lang, readAloud]);

  useEffect(() => {
    if (hydrated) document.documentElement.lang = lang;
  }, [hydrated, lang]);

  const steps = useMemo(() => buildSteps(answers), [answers]);
  const clamped = Math.min(index, Math.max(0, steps.length - 1));
  const current = stage === "questions" ? steps[clamped] ?? null : null;

  // Move one step forward, judged against the steps the *new* answers produce
  // (a picker answer inserts its card steps right after it). While editing from
  // the review, we only continue through cards of the same question, then return.
  const advance = useCallback(
    (a: Answers) => {
      const s = buildSteps(a);
      const nxt = s[clamped + 1];
      if (editing) {
        if (nxt && nxt.q.id === s[clamped]?.q.id) setIndex(clamped + 1);
        else {
          setEditing(false);
          setStage("review");
        }
        return;
      }
      if (!nxt) setStage("review");
      else setIndex(clamped + 1);
    },
    [clamped, editing]
  );

  const answer = useCallback(
    (id: string, value: AnswerValue | undefined, adv = false) => {
      let nextAnswers: Answers;
      if (value === undefined) {
        const { [id]: _drop, ...rest } = answers;
        nextAnswers = rest;
      } else nextAnswers = { ...answers, [id]: value };
      const dep = DEPENDENTS[id];
      if (dep && dep in answers && answers[id] !== value) {
        const depStep = buildSteps(answers).find((s) => s.id === dep);
        if (depStep && isInferred(depStep, answers)) {
          const { [dep]: _stale, ...rest } = nextAnswers;
          nextAnswers = rest;
        }
      }
      setAnswers(nextAnswers);
      if (adv) advance(nextAnswers);
    },
    [answers, advance]
  );

  const next = useCallback(() => advance(answers), [answers, advance]);

  const back = useCallback(() => {
    if (editing) {
      setEditing(false);
      setStage("review");
      return;
    }
    if (clamped === 0) {
      // Back to the intro keeps the answers: the welcome offers Continue / Start fresh.
      if (Object.keys(answers).length)
        setSaved({ answers, index: 0, stage: "questions", lang, readAloud, savedAt: Date.now() });
      setStage("welcome");
    } else setIndex(clamped - 1);
  }, [editing, clamped, answers, lang, readAloud]);

  const begin = useCallback(() => {
    setAnswers({});
    setIndex(0);
    setEditing(false);
    setSaved(null);
    setStage("questions");
  }, []);

  const resume = useCallback(() => {
    if (!saved) return;
    setAnswers(saved.answers);
    setSaved(null);
    setEditing(false);
    const first = firstUnanswered(saved.answers);
    if (saved.stage === "review" || first >= buildSteps(saved.answers).length) {
      setStage("review");
      return;
    }
    setIndex(Math.min(saved.index, first));
    setStage("questions");
  }, [saved]);

  const edit = useCallback(
    (stepId: string) => {
      const i = steps.findIndex((s) => s.id === stepId);
      if (i === -1) return;
      setIndex(i);
      setEditing(true);
      setStage("questions");
    },
    [steps]
  );

  const toReview = useCallback(() => {
    setEditing(false);
    setStage("review");
  }, []);
  const finish = useCallback(() => setStage("done"), []);

  const reset = useCallback(() => {
    clearIntake();
    setAnswers({});
    setIndex(0);
    setEditing(false);
    setSaved(null);
    setStage("welcome");
  }, []);

  return {
    hydrated,
    answers,
    steps,
    index: clamped,
    current,
    progress: steps.length ? clamped / steps.length : 0,
    stage,
    lang,
    readAloud,
    editing,
    saved,
    answer,
    next,
    back,
    begin,
    resume,
    edit,
    toReview,
    finish,
    reset,
    setLang,
    setReadAloud,
  };
}

export const currentAnswered = (intake: Intake) => !!intake.current && isAnswered(intake.current, intake.answers);
