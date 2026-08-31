// The pure brain of the intake — no React, no browser. The screen, the review
// page, the read-aloud text, the JSON export and scripts/verify-fill.ts all run
// through these same functions, so what the doctor sees is exactly what was
// stored, and a fixture patient can prove the whole form gets filled.

import {
  Answers,
  AnswerValue,
  Detail,
  HabitRow,
  Lang,
  Option,
  Question,
  QUESTIONS,
  RowAnswer,
  TableRow,
  TOTAL,
  optLabel,
  tx,
  YESNO_OPTIONS,
} from "./intake-schema";

export type StepKind = "number" | "single" | "multi" | "yesno" | "habits" | "picker" | "card" | "yesno-text";

/** One screen. A table question becomes a picker step plus one card per picked row. */
export interface Step {
  id: string;
  n: number;
  q: Question;
  kind: StepKind;
  row?: TableRow;
  /** card i of the picked rows */
  sub?: { i: number; of: number };
}

const rowsOf = (q: Question, a: Answers) => (a[q.id] as Record<string, RowAnswer> | undefined) ?? {};
const gateOn = (q: Question, a: Answers, row: TableRow) => rowsOf(q, a)[row.id]?.[q.gate!.id] === "yes";

/** A habit row is complete when answered, and its follow-up (if triggered) is filled. */
export const habitDone = (r: HabitRow, d?: Detail) =>
  !!d?.value && (d.value === "no" || !r.followup || !!d.detail?.trim());

export function steps(a: Answers): Step[] {
  const out: Step[] = [];
  for (const q of QUESTIONS) {
    if (q.kind !== "table") {
      out.push({ id: q.id, n: q.n, q, kind: q.kind });
      continue;
    }
    out.push({ id: `${q.id}.pick`, n: q.n, q, kind: "picker" });
    const picked = q.rows!.filter((r) => gateOn(q, a, r));
    picked.forEach((row, i) =>
      out.push({ id: `${q.id}.${row.id}`, n: q.n, q, kind: "card", row, sub: { i: i + 1, of: picked.length } })
    );
  }
  return out;
}

export function isAnswered(step: Step, a: Answers): boolean {
  const v = a[step.q.id];
  switch (step.kind) {
    case "number":
      return typeof v === "number";
    case "single":
    case "yesno":
      return typeof v === "string" && v !== "";
    case "multi":
      return Array.isArray(v) && v.length > 0;
    case "yesno-text": {
      const d = v as Detail | undefined;
      return !!d?.value && (d.value === "no" || !!d.detail?.trim());
    }
    case "habits": {
      const h = (v as Record<string, Detail> | undefined) ?? {};
      return step.q.habits!.every((r) => habitDone(r, h[r.id]));
    }
    case "picker": {
      const rows = rowsOf(step.q, a);
      return step.q.rows!.every((r) => !!rows[r.id]?.[step.q.gate!.id]);
    }
    case "card": {
      const ra = rowsOf(step.q, a)[step.row!.id] ?? {};
      return step.q.columns!.every((c) => !!ra[c.id]);
    }
  }
}

export const firstUnanswered = (a: Answers): number => {
  const s = steps(a);
  const i = s.findIndex((st) => !isAnswered(st, a));
  return i === -1 ? s.length : i;
};

/** Did an earlier answer (Q10 location/water change) make hard water likely? */
export const waterChanged = (a: Answers) => Array.isArray(a.past_6_months) && a.past_6_months.includes("location");

// ── Inference: fill from earlier answers, never commit without a tap ────────

export interface Suggestion {
  value: AnswerValue;
  reason: string;
  hi: string;
}

export function suggest(step: Step, a: Answers): Suggestion | undefined {
  // Only menopause safely implies "no pregnancy-related loss". Q6 = "Not
  // applicable" does NOT: a pregnant or breastfeeding patient has no periods
  // either, and Q7 is exactly the question that matters for her.
  if (step.id === "pregnancy_related" && a.menstrual_cycle === "menopausal")
    return {
      value: "na",
      reason: "You said menopausal, so we've marked this Not applicable — confirm if that's right.",
      hi: "आपने मेनोपॉज़ बताया, इसलिए हमने इसे 'लागू नहीं' रखा है — सही हो तो पुष्टि करें।",
    };
  if (step.id === "past_treatment_side_effects") {
    const [products, procedures] = [QUESTIONS[11], QUESTIONS[12]];
    const bad: string[] = [];
    for (const r of products.rows!) {
      const ra = rowsOf(products, a)[r.id];
      if (ra?.used !== "yes") continue;
      if (ra.side_effects === "yes") bad.push(`${r.label} — side effects`);
      if (ra.helped === "no") bad.push(`${r.label} — did not help`);
    }
    for (const r of procedures.rows!) {
      const ra = rowsOf(procedures, a)[r.id];
      if (ra?.done === "yes" && ra.helped === "no") bad.push(`${r.label} — did not help`);
    }
    if (bad.length)
      return {
        value: { value: "yes", detail: bad.join(". ") + "." },
        reason: "Filled in from your last two answers — edit anything, then confirm.",
        hi: "आपके पिछले दो जवाबों से भरा गया है — कुछ बदलना हो तो बदलें, फिर पुष्टि करें।",
      };
    const pickers = steps(a).filter((s) => s.kind === "picker");
    const allAnswered = pickers.every((s) => isAnswered(s, a));
    const anyTried = [products, procedures].some((q) => q.rows!.some((r) => gateOn(q, a, r)));
    if (allAnswered && !anyTried)
      return {
        value: { value: "no" },
        reason: "You haven't tried any treatment yet, so we've marked No — confirm if that's right.",
        hi: "आपने अभी तक कोई इलाज नहीं आज़माया, इसलिए हमने 'नहीं' रखा है — सही हो तो पुष्टि करें।",
      };
  }
  return undefined;
}

/** True when the stored answer is the one we suggested (used for review badges). */
export function isInferred(step: Step, a: Answers): boolean {
  const s = suggest(step, a);
  if (!s) return false;
  const v = a[step.q.id];
  if (v == null) return false;
  if (typeof s.value === "object" && !Array.isArray(s.value)) {
    const got = v as Detail;
    const want = s.value as Detail;
    // An edited description is the patient's own words, not our inference.
    return got.value === want.value && (got.detail ?? "").trim() === (want.detail ?? "").trim();
  }
  return v === s.value;
}

// ── Labels ─────────────────────────────────────────────────────────────────

const findOpt = (opts: Option[] | undefined, v: string) => opts?.find((o) => o.value === v);
/** The clinic-schema string for a stored value. */
const outOf = (opts: Option[] | undefined, v: string) => {
  const o = findOpt(opts, v);
  return o ? o.out ?? o.label : v;
};
const labelOf = (opts: Option[] | undefined, v: string, lang: Lang) => {
  const o = findOpt(opts, v);
  return o ? optLabel(o, lang) : v;
};
const yn = (v: string | undefined, lang: Lang) => (v ? labelOf(YESNO_OPTIONS, v, lang) : "—");

/** Consent body with the chosen sample type filled in. */
export function bodyText(q: Question, a: Answers, lang: Lang): string {
  const body = tx(lang, q.body ?? "", q.hi?.body);
  const sampleQ = QUESTIONS[14];
  const chosen = typeof a.sample_type === "string" ? labelOf(sampleQ.options, a.sample_type, lang) : "";
  const fallback = lang === "hi" ? "लार या खून का" : "saliva or blood";
  const sample = chosen && a.sample_type !== "either" ? (lang === "en" ? chosen.toLowerCase() : chosen) : fallback;
  return body.replace("{sample}", sample);
}

// ── Export: the clinic's schema, every key always present ──────────────────

export function toSchemaJson(a: Answers, lang: Lang = "en"): Record<string, unknown> {
  const out: Record<string, unknown> = { form: "GenoRoot Hair & Scalp Intake" };
  for (const q of QUESTIONS) {
    const v = a[q.id];
    switch (q.kind) {
      case "number":
        out[q.id] = typeof v === "number" ? v : null;
        break;
      case "single":
        out[q.id] = typeof v === "string" ? outOf(q.options, v) : null;
        break;
      case "yesno":
        out[q.id] = v === "yes" || v === "no" ? v : null;
        break;
      case "multi":
        out[q.id] = Array.isArray(v)
          ? v.filter((x) => !findOpt(q.options, x)?.uiOnly).map((x) => outOf(q.options, x))
          : null;
        break;
      case "yesno-text": {
        const d = v as Detail | undefined;
        out[q.id] = d?.value ?? null;
        if (d?.value === "yes") out.describe = d.detail ?? "";
        break;
      }
      case "habits": {
        const h = (v as Record<string, Detail> | undefined) ?? {};
        const o: Record<string, string | null> = {};
        for (const r of q.habits!) {
          const d = h[r.id];
          o[r.id] = d?.value ? (r.kind === "single" ? outOf(r.options, d.value) : d.value) : null;
          if (r.followup && d?.value === "yes")
            o[r.followup.id] =
              r.followup.kind === "single" ? outOf(r.followup.options, d.detail ?? "") : d.detail ?? "";
        }
        out[q.id] = o;
        break;
      }
      case "table": {
        const rows = rowsOf(q, a);
        const o: Record<string, Record<string, unknown>> = {};
        for (const r of q.rows!) {
          const ra = rows[r.id];
          const g = ra?.[q.gate!.id];
          const cell: Record<string, unknown> = { [q.gate!.id]: g ? g === "yes" : null };
          if (g === "yes")
            for (const c of q.columns!)
              cell[c.id] = ra[c.id] ? (c.kind === "single" ? outOf(c.options, ra[c.id]) : ra[c.id]) : null;
          o[r.out] = cell;
        }
        out[q.id] = o;
        break;
      }
    }
  }
  out._meta = {
    language: lang,
    inferred: steps(a)
      .filter((s) => isInferred(s, a))
      .map((s) => s.q.id),
  };
  return out;
}

// ── Review: the filled form, straight from the answers ─────────────────────

const COLUMN_SHORT: Record<string, { en: string; hi: string }> = {
  helped: { en: "helped", hi: "फ़ायदा" },
  side_effects: { en: "side effects", hi: "साइड इफ़ेक्ट" },
};

export interface FormLine {
  label: string;
  value: string;
}
export interface FormRow {
  n: number;
  q: Question;
  /** where Edit jumps to */
  stepId: string;
  value?: string;
  lines?: FormLine[];
  answered: boolean;
  inferred: boolean;
}

export function buildFilledForm(a: Answers, lang: Lang): FormRow[] {
  const all = steps(a);
  return QUESTIONS.map((q): FormRow => {
    const v = a[q.id];
    const qSteps = all.filter((s) => s.q.id === q.id);
    const answered = qSteps.every((s) => isAnswered(s, a));
    const inferred = qSteps.some((s) => isInferred(s, a));
    const base = { n: q.n, q, stepId: qSteps[0].id, answered, inferred };
    const dash = "—";
    switch (q.kind) {
      case "number":
        return { ...base, value: typeof v === "number" ? String(v) : dash };
      case "single":
        return { ...base, value: typeof v === "string" ? labelOf(q.options, v, lang) : dash };
      case "yesno":
        return { ...base, value: typeof v === "string" ? yn(v, lang) : dash };
      case "multi":
        return { ...base, value: Array.isArray(v) && v.length ? v.map((x) => labelOf(q.options, x, lang)).join(", ") : dash };
      case "yesno-text": {
        const d = v as Detail | undefined;
        return { ...base, value: !d?.value ? dash : d.value === "no" ? yn("no", lang) : `${yn("yes", lang)} — ${d.detail ?? ""}` };
      }
      case "habits": {
        const h = (v as Record<string, Detail> | undefined) ?? {};
        return {
          ...base,
          lines: q.habits!.map((r) => {
            const d = h[r.id];
            let val = dash;
            if (d?.value) {
              val = r.kind === "single" ? labelOf(r.options, d.value, lang) : yn(d.value, lang);
              if (r.followup && d.value === "yes" && d.detail)
                val += ` · ${r.followup.kind === "single" ? labelOf(r.followup.options, d.detail, lang) : d.detail}`;
            }
            return { label: tx(lang, r.label, r.hi), value: val };
          }),
        };
      }
      case "table": {
        const rows = rowsOf(q, a);
        const notLabel = q.id === "products" ? tx(lang, "Not used", "इस्तेमाल नहीं किया") : tx(lang, "Not done", "नहीं करवाया");
        return {
          ...base,
          lines: q.rows!.map((r) => {
            const ra = rows[r.id];
            const g = ra?.[q.gate!.id];
            let val = dash;
            if (g === "no") val = notLabel;
            else if (g === "yes")
              val = q
                .columns!.map((c) => {
                  const cv = ra[c.id];
                  const shown = !cv ? dash : c.kind === "single" ? labelOf(c.options, cv, lang) : yn(cv, lang);
                  const short = COLUMN_SHORT[c.id];
                  return c.kind === "single" || !short ? shown : `${tx(lang, short.en, short.hi)}: ${shown}`;
                })
                .join(" · ");
            return { label: tx(lang, r.label, r.hi), value: val };
          }),
        };
      }
    }
  });
}

/** Human label for a (proposed) answer value — used in the "Heard → …" strip. */
export function valueLabel(step: Step, value: AnswerValue, lang: Lang): string {
  const q = step.q;
  switch (step.kind) {
    case "number":
      return String(value);
    case "single":
      return labelOf(q.options, value as string, lang);
    case "yesno":
      return yn(value as string, lang);
    case "multi":
      return (value as string[]).map((v) => labelOf(q.options, v, lang)).join(", ");
    case "picker": {
      const rows = value as Record<string, RowAnswer>;
      const picked = q.rows!.filter((r) => rows[r.id]?.[q.gate!.id] === "yes").map((r) => tx(lang, r.label, r.hi));
      return picked.length ? picked.join(", ") : tx(lang, "None of these", "इनमें से कुछ नहीं");
    }
    case "yesno-text": {
      const d = value as Detail;
      return d.value === "no" ? yn("no", lang) : `${yn("yes", lang)}${d.detail ? ` — ${d.detail}` : ""}`;
    }
    default:
      return "";
  }
}

// ── Read-aloud text: same source as the screen ─────────────────────────────

const speakOptions = (opts: Option[], lang: Lang) =>
  (lang === "hi" ? "विकल्प: " : "Options: ") + opts.map((o, i) => `${i + 1}, ${optLabel(o, lang)}`).join(". ") + ".";

/** The options the way they are read out, numbered — the same numbers the parser accepts ("option 2"). */
export function optionsSpeech(step: Step, lang: Lang): string {
  const q = step.q;
  switch (step.kind) {
    case "single":
    case "multi":
      return speakOptions(q.options!, lang);
    case "yesno":
    case "yesno-text":
      return speakOptions(YESNO_OPTIONS, lang);
    case "picker":
      return speakOptions(
        [...q.rows!.map((r) => ({ value: r.id, label: r.label, hi: r.hi })), { value: "none", label: "None of these", hi: "इनमें से कुछ नहीं" }],
        lang
      );
    default:
      return "";
  }
}

export function speakText(step: Step, a: Answers, lang: Lang): string {
  const q = step.q;
  const L = (en: string, hi?: string) => tx(lang, en, hi);
  const parts: string[] = [lang === "hi" ? `सवाल ${q.n}, कुल ${TOTAL} में से।` : `Question ${q.n} of ${TOTAL}.`];
  if (step.kind === "card") {
    parts.push(L(step.row!.label, step.row!.hi) + ".");
    for (const c of q.columns!) parts.push(`${L(c.label, c.hi)} ${speakOptions(c.kind === "yesno" ? YESNO_OPTIONS : c.options!, lang)}`);
    return parts.join(" ");
  }
  parts.push(L(q.prompt, q.hi?.prompt));
  if (q.body) parts.push(bodyText(q, a, lang));
  if (q.hint) parts.push(L(q.hint, q.hi?.hint));
  const o = optionsSpeech(step, lang);
  if (o) parts.push(o);
  return parts.join(" ");
}
