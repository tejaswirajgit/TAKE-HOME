import { Answers, Lang, QUESTION_BY_ID } from "./intake-schema";

// On-device autosave so a patient who puts the phone down can pick up where
// they left off. localStorage only — nothing leaves the browser, no account.

const KEY = "haiku-intake-v2";

export type Stage = "welcome" | "questions" | "review" | "done";

export interface Saved {
  answers: Answers;
  index: number;
  stage: Stage;
  lang: Lang;
  readAloud: boolean;
  savedAt: number;
}

export function loadIntake(): Saved | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Saved>;
    if (!d || typeof d !== "object" || !d.answers || typeof d.answers !== "object") return null;
    // Drop anything from an older schema so a stale save can't confuse the flow.
    const answers: Answers = Object.fromEntries(Object.entries(d.answers).filter(([k]) => k in QUESTION_BY_ID));
    return {
      answers,
      index: typeof d.index === "number" && d.index >= 0 ? d.index : 0,
      stage: d.stage === "review" || d.stage === "done" ? "review" : "questions",
      lang: d.lang === "hi" ? "hi" : "en",
      readAloud: !!d.readAloud,
      savedAt: typeof d.savedAt === "number" ? d.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveIntake(s: Omit<Saved, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...s, savedAt: Date.now() }));
  } catch {
    /* storage full or disabled — resume is a nicety, never a blocker */
  }
}

export function clearIntake(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
