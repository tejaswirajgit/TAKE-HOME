"use client";

import { KeyboardEvent, ReactNode, useEffect, useState } from "react";
import {
  Answers,
  AnswerValue,
  Detail,
  Field,
  Lang,
  Option,
  Question,
  RowAnswer,
  TableRow,
  YESNO_OPTIONS,
  optLabel,
  tx,
} from "@/lib/intake-schema";
import { Step, Suggestion, habitDone, waterChanged } from "@/lib/flow";
import { STR } from "@/lib/strings";

// Per-question controls — the "taste" of the intake. Each kind of question gets
// the control that is actually right for it: one-tap chips that advance, a
// stepper for the one number, a flowing list for habits, a picker + small cards
// for the two grids, and free text (with dictation) only where words are needed.

export interface InputProps {
  step: Step;
  answers: Answers;
  lang: Lang;
  suggestion?: Suggestion;
  onAnswer: (value: AnswerValue | undefined, advance?: boolean) => void;
  onNext: () => void;
  /** Renders a dictation control that appends speech into a text field. */
  dictation?: (onText: (t: string) => void) => ReactNode;
}

export function QuestionInput(p: InputProps) {
  const { step, answers, lang, suggestion, onAnswer, onNext, dictation } = p;
  const q = step.q;
  const v = answers[q.id];
  switch (step.kind) {
    case "number":
      return <NumberInput q={q} value={v as number | undefined} lang={lang} onAnswer={onAnswer} onNext={onNext} />;
    case "single": {
      const shown = (typeof v === "string" ? v : undefined) ?? (suggestion?.value as string | undefined);
      return <Chips options={q.options!} value={shown} lang={lang} onPick={(val) => onAnswer(val, q.autoAdvance !== false)} />;
    }
    case "yesno": {
      const shown = (typeof v === "string" ? v : undefined) ?? (suggestion?.value as string | undefined);
      return (
        <Chips cols={2} big options={YESNO_OPTIONS} value={shown} lang={lang} onPick={(val) => onAnswer(val, q.autoAdvance !== false)} />
      );
    }
    case "multi":
      return <MultiChips options={q.options!} value={(v as string[]) ?? []} lang={lang} onChange={onAnswer} />;
    case "habits":
      return (
        <HabitsInput
          q={q}
          value={v as Record<string, Detail> | undefined}
          answers={answers}
          lang={lang}
          onAnswer={onAnswer}
          dictation={dictation}
        />
      );
    case "picker":
      return <PickerInput q={q} value={v as Record<string, RowAnswer> | undefined} lang={lang} onAnswer={onAnswer} />;
    case "card":
      return (
        <CardInput q={q} row={step.row!} value={v as Record<string, RowAnswer> | undefined} lang={lang} onAnswer={onAnswer} />
      );
    case "yesno-text":
      return (
        <YesNoText
          q={q}
          value={v as Detail | undefined}
          suggestion={suggestion}
          lang={lang}
          onAnswer={onAnswer}
          dictation={dictation}
        />
      );
  }
}

// ── Chips ──────────────────────────────────────────────────────────────────

/** Arrow keys move between the chips of one group (radio/checkbox semantics). */
function arrowNav(e: KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
  const chips = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-chip]"));
  const i = chips.indexOf(document.activeElement as HTMLButtonElement);
  if (i === -1) return;
  e.preventDefault();
  const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
  chips[(i + dir + chips.length) % chips.length]?.focus();
}

function Chip({
  on,
  role,
  onClick,
  sm,
  center,
  className = "",
  children,
}: {
  on: boolean;
  role: "radio" | "checkbox";
  onClick: () => void;
  sm?: boolean;
  center?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={on}
      data-chip
      onClick={onClick}
      className={`${sm ? "choice-sm" : "choice"} ${center ? "text-center" : ""} ${on ? "choice-selected" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

function Chips({
  options,
  value,
  lang,
  onPick,
  cols,
  sm,
  big,
  label,
}: {
  options: Option[];
  value?: string;
  lang: Lang;
  onPick: (v: string) => void;
  cols?: 2 | 3;
  sm?: boolean;
  big?: boolean;
  label?: string;
}) {
  const layout = cols === 2 ? "grid grid-cols-2 gap-3" : cols === 3 ? "grid grid-cols-3 gap-2" : "flex flex-col gap-3";
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={arrowNav} className={layout}>
      {options.map((o) => (
        <Chip
          key={o.value}
          role="radio"
          on={value === o.value}
          onClick={() => onPick(o.value)}
          sm={sm}
          center={!!cols}
          className={big ? "text-xl font-medium" : ""}
        >
          {optLabel(o, lang)}
        </Chip>
      ))}
    </div>
  );
}

function MultiChips({
  options,
  value,
  lang,
  onChange,
}: {
  options: Option[];
  value: string[];
  lang: Lang;
  onChange: (v: string[], advance?: boolean) => void;
}) {
  const toggle = (o: Option) => {
    if (o.exclusive) {
      // A chip that must stand alone behaves like a single-select: it advances.
      const turningOn = !value.includes(o.value);
      onChange(turningOn ? [o.value] : [], turningOn);
      return;
    }
    const exclusives = options.filter((x) => x.exclusive).map((x) => x.value);
    const base = value.filter((v) => !exclusives.includes(v));
    onChange(base.includes(o.value) ? base.filter((v) => v !== o.value) : [...base, o.value], false);
  };
  return (
    <div role="group" onKeyDown={arrowNav} className="flex flex-col gap-3">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role="checkbox"
            aria-checked={on}
            data-chip
            onClick={() => toggle(o)}
            className={`choice flex items-center justify-between ${on ? "choice-selected" : ""}`}
          >
            <span>{optLabel(o, lang)}</span>
            <span
              aria-hidden
              className={`ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                on ? "border-white bg-white text-black" : "border-black/25"
              }`}
            >
              {on ? "✓" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Q1 · number ────────────────────────────────────────────────────────────

const DECADES = [15, 25, 35, 45, 55];
const decadeIndex = (n: number) => (n < 20 ? 0 : n < 30 ? 1 : n < 40 ? 2 : n < 50 ? 3 : 4);

function NumberInput({
  q,
  value,
  lang,
  onAnswer,
  onNext,
}: {
  q: Question;
  value?: number;
  lang: Lang;
  onAnswer: (v: AnswerValue | undefined) => void;
  onNext: () => void;
}) {
  const cfg = q.number!;
  const s = STR[lang];
  const [local, setLocal] = useState(value != null ? String(value) : "");
  // A spoken number lands in `value`; mirror it into the field.
  useEffect(() => {
    if (value != null && String(value) !== local) setLocal(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const parsed = local === "" ? null : parseInt(local, 10);
  const tooLow = parsed != null && parsed < cfg.min;
  const tooHigh = parsed != null && parsed > cfg.max;
  const valid = parsed != null && !tooLow && !tooHigh;

  // Only a valid, in-range number ever becomes an answer.
  const commit = (raw: string) => {
    const n = raw === "" ? NaN : parseInt(raw, 10);
    onAnswer(!Number.isNaN(n) && n >= cfg.min && n <= cfg.max ? n : undefined);
  };
  const set = (n: number) => {
    const c = Math.max(cfg.min, Math.min(cfg.max, n));
    setLocal(String(c));
    onAnswer(c);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div role="radiogroup" aria-label={s.decades.join(", ")} onKeyDown={arrowNav} className="grid w-full grid-cols-5 gap-2">
        {DECADES.map((d, i) => (
          <Chip key={d} role="radio" sm center on={parsed != null && decadeIndex(parsed) === i} onClick={() => set(d)}>
            {s.decades[i]}
          </Chip>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="btn-ghost text-3xl disabled:opacity-30"
          onClick={() => set((parsed ?? 26) - 1)}
          disabled={parsed != null && parsed <= cfg.min}
          aria-label={s.less}
        >
          −
        </button>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          aria-label={tx(lang, q.prompt, q.hi?.prompt)}
          aria-describedby="age-help"
          aria-invalid={tooLow || tooHigh}
          className={`w-32 rounded-2xl border-2 bg-white py-4 text-center text-4xl font-semibold outline-none transition-colors ${
            tooLow || tooHigh ? "border-red-400 text-red-500" : "border-black/10 focus:border-ink"
          }`}
          placeholder="35"
          value={local}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 2);
            setLocal(v);
            commit(v);
            // Two valid digits: drop the keyboard so the Continue button is visible.
            const n = parseInt(v, 10);
            if (v.length === 2 && n >= cfg.min && n <= cfg.max) e.target.blur();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) {
              e.preventDefault();
              onNext();
            }
          }}
        />
        <button
          type="button"
          className="btn-ghost text-3xl disabled:opacity-30"
          onClick={() => set((parsed ?? 24) + 1)}
          disabled={parsed != null && parsed >= cfg.max}
          aria-label={s.more}
        >
          +
        </button>
      </div>
      <p className="text-ink/50">{s.yearsOld}</p>
      <p
        id="age-help"
        className={
          tooLow || tooHigh ? "rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-500" : "text-xs text-ink/40"
        }
      >
        {tooLow ? s.tooLow(cfg.min) : tooHigh ? s.tooHigh(cfg.max) : s.ageRange(cfg.min, cfg.max)}
      </p>
    </div>
  );
}

// ── Text with dictation ────────────────────────────────────────────────────

function TextField({
  value,
  onChange,
  label,
  placeholder,
  rows,
  dictation,
}: {
  value: string;
  onChange: (t: string) => void;
  label: string;
  placeholder?: string;
  rows: number;
  dictation?: InputProps["dictation"];
}) {
  return (
    <div className="relative">
      <textarea
        aria-label={label}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-none rounded-2xl border-2 border-black/15 bg-white px-4 py-3 pr-16 text-lg outline-none transition-colors focus:border-ink"
      />
      {dictation && (
        <div className="absolute bottom-2 right-2">{dictation((t) => onChange(value.trim() ? `${value.trim()} ${t}` : t))}</div>
      )}
    </div>
  );
}

// ── Q11 · habits, one flowing screen ───────────────────────────────────────

function HabitsInput({
  q,
  value,
  answers,
  lang,
  onAnswer,
  dictation,
}: {
  q: Question;
  value?: Record<string, Detail>;
  answers: Answers;
  lang: Lang;
  onAnswer: (v: AnswerValue) => void;
  dictation?: InputProps["dictation"];
}) {
  const s = STR[lang];
  const h = value ?? {};
  const set = (rowId: string, d: Detail, scroll = true) => {
    onAnswer({ ...h, [rowId]: d });
    const row = q.habits!.find((r) => r.id === rowId)!;
    // Once this row is complete, bring the next unanswered one into view.
    if (scroll && habitDone(row, d))
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(`[data-row]:not([data-row="${rowId}"])[data-missing="true"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" })
      );
  };

  return (
    <div className="flex flex-col gap-3">
      {q.habits!.map((r) => {
        const d = h[r.id];
        const done = habitDone(r, d);
        const nudge = r.id === "hard_water" && waterChanged(answers);
        return (
          <fieldset key={r.id} data-row={r.id} data-missing={!done} className="rounded-2xl border border-black/10 bg-white/60 p-3">
            <legend className="px-1 text-base font-medium">{tx(lang, r.label, r.hi)}</legend>
            {(r.hint || nudge) && (
              <p className={`mb-2 text-sm ${nudge ? "rounded-lg bg-black/[0.05] px-2 py-1.5 text-ink/80" : "px-1 text-ink/50"}`}>
                {nudge ? s.waterNudge : tx(lang, r.hint!, r.hiHint)}
              </p>
            )}
            {r.kind === "yesno" ? (
              <Chips
                sm
                cols={2}
                options={YESNO_OPTIONS}
                value={d?.value}
                lang={lang}
                onPick={(v) => set(r.id, { value: v, detail: v === "yes" ? d?.detail : undefined })}
              />
            ) : (
              <Chips sm cols={3} options={r.options!} value={d?.value} lang={lang} onPick={(v) => set(r.id, { value: v })} />
            )}
            {r.followup && d?.value === "yes" && (
              <div className="mt-2">
                <p className="mb-1.5 px-1 text-sm text-ink/60">{tx(lang, r.followup.label, r.followup.hi)}</p>
                {r.followup.kind === "single" ? (
                  <Chips
                    sm
                    cols={3}
                    options={r.followup.options!}
                    value={d.detail}
                    lang={lang}
                    onPick={(v) => set(r.id, { value: "yes", detail: v })}
                  />
                ) : (
                  <TextField
                    rows={1}
                    value={d.detail ?? ""}
                    label={tx(lang, r.followup.label, r.followup.hi)}
                    placeholder={lang === "hi" ? "केराटिन, रीबॉन्डिंग…" : "Keratin, rebonding…"}
                    dictation={dictation}
                    onChange={(t) => set(r.id, { value: "yes", detail: t }, false)}
                  />
                )}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}

// ── Q12/Q13 · picker, then one card per pick ───────────────────────────────

function PickerInput({
  q,
  value,
  lang,
  onAnswer,
}: {
  q: Question;
  value?: Record<string, RowAnswer>;
  lang: Lang;
  onAnswer: (v: AnswerValue, advance?: boolean) => void;
}) {
  const s = STR[lang];
  const rows = value ?? {};
  const gate = q.gate!.id;
  const picked = q.rows!.filter((r) => rows[r.id]?.[gate] === "yes").map((r) => r.id);
  const allNo = q.rows!.every((r) => rows[r.id]?.[gate] === "no");

  // Every row gets its gate answered in one go; unpicked rows are an explicit "no".
  const write = (ids: string[], advance: boolean) => {
    const next: Record<string, RowAnswer> = {};
    for (const r of q.rows!) next[r.id] = ids.includes(r.id) ? { ...(rows[r.id] ?? {}), [gate]: "yes" } : { [gate]: "no" };
    onAnswer(next, advance);
  };

  const options: Option[] = [
    ...q.rows!.map((r) => ({ value: r.id, label: r.label, hi: r.hi })),
    { value: "__none", label: q.id === "products" ? s.none : s.noneDone, exclusive: true },
  ];
  return (
    <MultiChips
      options={options}
      value={allNo ? ["__none"] : picked}
      lang={lang}
      onChange={(v, adv) => write(v.filter((x) => x !== "__none"), !!adv && v.includes("__none"))}
    />
  );
}

function CardInput({
  q,
  row,
  value,
  lang,
  onAnswer,
}: {
  q: Question;
  row: TableRow;
  value?: Record<string, RowAnswer>;
  lang: Lang;
  onAnswer: (v: AnswerValue, advance?: boolean) => void;
}) {
  const rows = value ?? {};
  const ra = rows[row.id] ?? {};
  const set = (col: Field, v: string) => {
    const nextRow = { ...ra, [col.id]: v };
    const complete = q.columns!.every((c) => !!nextRow[c.id]);
    onAnswer({ ...rows, [row.id]: nextRow }, complete);
  };
  return (
    <div className="flex flex-col gap-4">
      {q.columns!.map((c) => (
        <fieldset key={c.id} data-missing={!ra[c.id]} className="rounded-2xl border border-black/10 bg-white/60 p-3">
          <legend className="px-1 text-base font-medium">{tx(lang, c.label, c.hi)}</legend>
          <Chips
            sm
            cols={c.kind === "yesno" ? 2 : 3}
            options={c.kind === "yesno" ? YESNO_OPTIONS : c.options!}
            value={ra[c.id]}
            lang={lang}
            onPick={(v) => set(c, v)}
          />
        </fieldset>
      ))}
    </div>
  );
}

// ── Q14 · yes/no, then describe ────────────────────────────────────────────

function YesNoText({
  q,
  value,
  suggestion,
  lang,
  onAnswer,
  dictation,
}: {
  q: Question;
  value?: Detail;
  suggestion?: Suggestion;
  lang: Lang;
  onAnswer: (v: AnswerValue, advance?: boolean) => void;
  dictation?: InputProps["dictation"];
}) {
  const s = STR[lang];
  const sug = suggestion?.value as Detail | undefined;
  const shown = value ?? sug;
  const pick = (v: string) => {
    if (v === "no") onAnswer({ value: "no" }, true);
    else onAnswer({ value: "yes", detail: value?.detail ?? sug?.detail ?? "" });
  };
  return (
    <div className="flex flex-col gap-3">
      <Chips cols={2} big options={YESNO_OPTIONS} value={shown?.value} lang={lang} onPick={pick} />
      {shown?.value === "yes" && (
        <div className="mt-1">
          {!value && sug && (
            <span className="eyebrow mb-2 inline-block rounded bg-black/5 px-2 py-1 text-ink/60">{s.fromYourAnswers}</span>
          )}
          <TextField
            rows={3}
            value={shown.detail ?? ""}
            label={tx(lang, q.hint ?? q.prompt, q.hi?.hint)}
            placeholder={s.describePlaceholder}
            dictation={dictation}
            onChange={(t) => onAnswer({ value: "yes", detail: t })}
          />
        </div>
      )}
    </div>
  );
}
