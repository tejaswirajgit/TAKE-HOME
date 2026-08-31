"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Intake } from "@/lib/use-intake";
import { STR } from "@/lib/strings";
import { AnswerValue, Detail, SECTIONS, TOTAL, tx } from "@/lib/intake-schema";
import { Suggestion, bodyText, habitDone, isAnswered, speakText, suggest, valueLabel } from "@/lib/flow";
import { parseAnswer } from "@/lib/answer-parser";
import { useSpeech } from "@/lib/use-speech";
import { IntakeFrame, ProgressBar, SectionBadge, StickyNext } from "./intake-shell";
import { TopBar } from "./top-bar";
import { QuestionInput } from "./question-input";
import { MicButton } from "./voice-lane";

// One question per screen. The heading takes focus on every step (screen
// readers hear "Question n of 16 …"), the sticky button always says what to do
// next, a laptop can drive it from the keyboard, and the mic / read-aloud lanes
// sit on top of the same tap controls — never instead of them.
//
// Both inference and voice produce a *suggestion*: shown pre-selected, with a
// reason line, and a Confirm button. Nothing is stored until the patient taps.

export function QuestionScreen({ intake }: { intake: Intake }) {
  const step = intake.current!;
  const { answers, lang, readAloud } = intake;
  const s = STR[lang];
  const q = step.q;

  const answered = isAnswered(step, answers);
  const stored = answers[q.id];
  const inferred = useMemo(() => suggest(step, answers), [step, answers]);
  const [heard, setHeard] = useState<{ transcript: string; value: AnswerValue | null } | null>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const stepRef = useRef(step.id);
  stepRef.current = step.id;
  const speech = useSpeech(readAloud);

  // A spoken answer becomes a suggestion; an inference only while nothing is
  // stored yet (the moment the patient taps anything, their tap wins).
  const suggestion: Suggestion | undefined = useMemo(() => {
    if (heard?.value != null) {
      const reason = `${s.heard}: “${heard.transcript}” → ${valueLabel(step, heard.value, lang)}`;
      return { value: heard.value, reason, hi: reason };
    }
    return stored === undefined ? inferred : undefined;
  }, [heard, inferred, stored, step, lang, s]);

  useEffect(() => {
    setHeard(null);
    window.scrollTo({ top: 0 });
    if (step.kind === "number") document.querySelector<HTMLInputElement>("#answers input")?.focus();
    else h1Ref.current?.focus();
  }, [step.id, step.kind]);

  // Read-aloud: the question (and any pre-filled reason) on every step.
  useEffect(() => {
    if (!readAloud) return;
    const extra = stored === undefined && inferred ? ` ${tx(lang, inferred.reason, inferred.hi)}` : "";
    speech.speak(speakText(step, answers, lang) + extra, lang);
    return () => speech.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id, readAloud, lang]);

  const onTranscript = useCallback(
    async (transcript: string) => {
      const forStep = step.id;
      const r = await parseAnswer(step, transcript, answers[q.id]);
      if (stepRef.current !== forStep) return; // the patient has moved on — never land on the next question
      setHeard({ transcript, value: r.value });
      if (readAloud) {
        const line = r.value != null ? `${s.heard}: ${valueLabel(step, r.value, lang)}. ${s.confirm}?` : s.tryAgain;
        speech.speak(line, lang);
      }
    },
    [step, answers, q.id, readAloud, lang, s, speech]
  );

  const isCard = step.kind === "card";
  const title = isCard ? tx(lang, step.row!.label, step.row!.hi) : tx(lang, q.prompt, q.hi?.prompt);
  const hint = !isCard && q.hint ? tx(lang, q.hint, q.hi?.hint) : undefined;
  const body = q.body ? bodyText(q, answers, lang) : undefined;
  const eyebrow = isCard
    ? s.cardOf(q.id === "products" ? s.product : s.procedure, step.sub!.i, step.sub!.of)
    : tx(lang, SECTIONS[q.section].title, SECTIONS[q.section].hi);
  // Mic where speaking beats tapping; everywhere the parser can help in read-aloud mode.
  const parsable = !["habits", "card"].includes(step.kind);
  const showMic = parsable && ((q.mic && step.kind !== "yesno-text") || readAloud);

  // ── The one button ───────────────────────────────────────────────────────
  const missing =
    step.kind === "habits"
      ? q.habits!.filter((r) => !habitDone(r, (answers.habits as Record<string, Detail> | undefined)?.[r.id])).length
      : 0;
  const flashMissing = () => {
    const el = document.querySelector<HTMLElement>('#answers [data-missing="true"]');
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
    el.querySelector<HTMLButtonElement>("[data-chip]")?.focus({ preventScroll: true });
  };
  const autoKind = step.kind === "single" || step.kind === "yesno";
  let label = intake.editing ? s.save : q.n === TOTAL ? s.finish : autoKind ? s.next : s.continue;
  let enabled = answered;
  let onCta: () => void = intake.next;
  if (step.kind === "habits" && missing) {
    label = s.left(missing);
    enabled = true;
    onCta = flashMissing;
  } else if (suggestion) {
    label = s.confirm;
    enabled = true;
    // Commit the suggestion; advance only if that actually completes the step
    // (a spoken "haan" on Q14 still needs its description).
    onCta = () => intake.answer(q.id, suggestion.value, isAnswered(step, { ...answers, [q.id]: suggestion.value }));
  }

  // ── Keyboard lane: 1–9 pick a chip, Enter continues, Backspace goes back ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
      const onControl = !!t?.closest("button, a, summary");
      if (e.key === "Enter") {
        // Enter on a focused button/link must activate it, not the sticky CTA.
        if (!typing && !onControl && enabled) {
          e.preventDefault();
          onCta();
        }
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Backspace") {
        if (intake.index > 0 || intake.editing) {
          e.preventDefault();
          intake.back();
        }
        return;
      }
      if (step.kind !== "number" && /^[1-9]$/.test(e.key)) {
        // Inside a fieldset (habit row / card field) the digits index that row's chips.
        const root = (document.activeElement as HTMLElement | null)?.closest("fieldset") ?? document.getElementById("answers");
        const chips = root?.querySelectorAll<HTMLButtonElement>("[data-chip]") ?? [];
        chips[Number(e.key) - 1]?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onCta, intake, step.kind]);

  return (
    <IntakeFrame>
      <a
        href="#answers"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        {s.skipToAnswers}
      </a>
      <TopBar
        onBack={intake.back}
        lang={lang}
        setLang={intake.setLang}
        readAloud={readAloud}
        setReadAloud={intake.setReadAloud}
      />
      <ProgressBar n={q.n} sub={step.sub} label={s.questionOf(q.n, TOTAL)} />

      <div key={step.id} className="fadein mt-7 flex flex-1 flex-col pb-32">
        <div className="flex items-center justify-between gap-2">
          <SectionBadge icon={SECTIONS[q.section].icon} label={eyebrow} />
          {readAloud && (
            <button
              type="button"
              className="btn-ghost -mr-3 flex items-center gap-1 text-sm"
              onClick={() => speech.speak(speakText(step, answers, lang), lang)}
              aria-label={s.readAgain}
            >
              <span aria-hidden>🔊</span> {s.readAgain}
            </button>
          )}
        </div>
        <h1
          ref={h1Ref}
          tabIndex={-1}
          className="mt-4 font-display text-[28px] font-light leading-[1.15] tracking-[-0.01em] text-balance outline-none md:text-[34px]"
        >
          <span className="sr-only">{s.questionOf(q.n, TOTAL)}. </span>
          {title}
        </h1>
        {hint && <p className="mt-2.5 text-ink/60">{hint}</p>}
        {body && <p className="mt-3 text-lg leading-relaxed text-ink/80">{body}</p>}

        {showMic && <MicButton lang={lang} onTranscript={onTranscript} />}

        {suggestion && (
          <p role="status" className="mt-3 rounded-xl bg-black/[0.04] px-3 py-2 text-sm text-ink/70">
            {tx(lang, suggestion.reason, suggestion.hi)}
          </p>
        )}
        {heard && heard.value == null && (
          <p role="status" className="mt-3 text-sm italic text-ink/60">
            “{heard.transcript}” — {s.orTap}
          </p>
        )}

        <div id="answers" className="mt-5">
          <QuestionInput
            step={step}
            answers={answers}
            lang={lang}
            suggestion={suggestion}
            onAnswer={(v, adv) => {
              setHeard(null);
              intake.answer(q.id, v, adv);
            }}
            onNext={intake.next}
            dictation={(onText) => <MicButton compact lang={lang} onTranscript={onText} />}
          />
        </div>
      </div>

      <StickyNext onClick={onCta} enabled={enabled} label={label} hint={s.choose} />
    </IntakeFrame>
  );
}
