"use client";

import { Icon } from "./icons";
import { Intake } from "@/lib/use-intake";
import { STR } from "@/lib/strings";
import { QUESTIONS, optLabel } from "@/lib/intake-schema";

// The last thing the patient sees: a quiet exhale, and what happens next.

export function CompletionScreen({ intake }: { intake: Intake }) {
  const s = STR[intake.lang];
  const { answers, lang } = intake;
  const sampleQ = QUESTIONS[14];
  const sampleOpt = sampleQ.options!.find((o) => o.value === answers.sample_type);
  const sampleLabel = sampleOpt ? optLabel(sampleOpt, lang).toLowerCase() : "";
  const consented = answers.consent === "yes";

  return (
    <main className="frame flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 animate-[ring_1.4s_ease-out] rounded-full border border-ink/20" />
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ink text-paper">
          <Icon name="check" width={40} height={40} />
        </div>
      </div>

      <p className="eyebrow mt-8">{s.doneEyebrow}</p>
      <h1 className="mt-3 font-display text-4xl font-light leading-tight tracking-[-0.02em]" tabIndex={-1} autoFocus>
        {s.doneTitle}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink/55">{s.doneBody}</p>
      <p className="mt-2 text-base text-ink/45">
        {consented && sampleLabel && answers.sample_type !== "either" ? s.doneSample(sampleLabel) : consented ? "" : s.doneNoSample}
      </p>

      <button className="btn-primary mt-9 w-full" onClick={intake.toReview}>
        {s.seeFilled}
      </button>
      <button className="btn-ghost mt-1" onClick={intake.reset}>
        {s.startOver}
      </button>

      <style>{`@keyframes ring{0%{transform:scale(0.8);opacity:0.9}100%{transform:scale(1.35);opacity:0}}`}</style>
    </main>
  );
}
