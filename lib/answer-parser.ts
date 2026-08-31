// Transcript → answer. Rules first (free, instant); the LLM route only when the
// rules return nothing and the question is a choice between options. Anything
// the parser produces is a *suggestion* the patient still has to confirm.

import { AnswerValue, Option, Question, RowAnswer, YESNO_OPTIONS } from "./intake-schema";
import { Step } from "./flow";
import { parseRules, pickerValue } from "./voice-parse";

export interface Parsed {
  value: AnswerValue | null;
  confident: boolean;
  source: "rules" | "llm" | "none";
}

const NONE: Parsed = { value: null, confident: false, source: "none" };

function llmOptions(step: Step): Option[] | null {
  const q: Question = step.q;
  switch (step.kind) {
    case "single":
    case "multi":
      return q.options!.filter((o) => !o.uiOnly);
    case "yesno":
      return YESNO_OPTIONS;
    case "picker":
      return q.rows!.map((r) => ({ value: r.id, label: r.label, hi: r.hi }));
    default:
      return null;
  }
}

export async function parseAnswer(step: Step, transcript: string, prev?: AnswerValue, signal?: AbortSignal): Promise<Parsed> {
  const r = parseRules(step, transcript, prev);
  if (r.value != null) return { ...r, source: "rules" };

  const options = llmOptions(step);
  if (!options) return NONE;
  const kind = step.kind === "picker" ? "multi" : step.kind;
  try {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, prompt: step.q.prompt, options: options.map(({ value, label, hi }) => ({ value, label, hi })), transcript }),
      signal,
    });
    if (!res.ok) return NONE;
    const { values, confidence } = (await res.json()) as { values?: string[]; confidence?: string };
    if (!values?.length) return NONE;
    const multiLike = step.kind === "multi" || step.kind === "picker";
    const value: AnswerValue =
      step.kind === "picker" ? pickerValue(step.q, values, prev as Record<string, RowAnswer> | undefined) : multiLike ? values : values[0];
    return { value, confident: confidence === "high" && !multiLike, source: "llm" };
  } catch {
    return NONE;
  }
}
