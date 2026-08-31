"use client";

import { Icon } from "./icons";
import { IntakeFrame } from "./intake-shell";
import { TopBar } from "./top-bar";
import { Intake } from "@/lib/use-intake";
import { STR } from "@/lib/strings";
import { primeAudio } from "@/lib/use-speech";
import { primeMic } from "@/lib/use-voice";

// One calm screen, one clear button. If a saved intake exists, resuming is the
// primary action — people put the phone down in a waiting room.

export function Welcome({ intake }: { intake: Intake }) {
  const s = STR[intake.lang];
  const answeredCount = intake.saved ? Object.keys(intake.saved.answers).length : 0;
  const startAs = (voice: boolean) => {
    if (voice) {
      primeAudio();
      primeMic();
    }
    intake.setReadAloud(voice);
    intake.begin();
  };

  return (
    <IntakeFrame>
      <TopBar
        lang={intake.lang}
        setLang={intake.setLang}
        readAloud={intake.readAloud}
        setReadAloud={intake.setReadAloud}
      />
      <div className="flex flex-1 flex-col justify-center py-10">
        <div className="flex items-center gap-2 text-ink">
          <Icon name="hair" width={22} height={22} />
          <span className="eyebrow text-ink/60">{s.clinic}</span>
        </div>

        <h1 className="mt-6 font-display text-[40px] font-light leading-[1.08] tracking-[-0.02em] text-balance md:text-5xl">
          {s.welcomeTitle}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-ink/60">{s.welcomeBody}</p>

        {intake.saved ? (
          <div className="mt-8 rounded-2xl border border-ink/15 bg-white/60 p-4">
            <div className="flex items-center gap-2 text-ink/70">
              <Icon name="clock" width={16} height={16} />
              <p className="text-sm">{s.resumeTitle(answeredCount)}</p>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button className="btn-primary flex-1" onClick={intake.resume}>
                {s.resume}
              </button>
              <button className="btn-ghost border border-black/10" onClick={intake.begin}>
                {s.startFresh}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button className="btn-primary mt-8 w-full" onClick={intake.begin}>
              {s.begin}
            </button>
            <p className="mt-8 text-center text-sm text-ink/60">{s.differentWay}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                { voice: false, icon: "tap" as const, label: s.tapping },
                { voice: true, icon: "mic" as const, label: s.speaking },
              ].map((m) => (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => startAs(m.voice)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-black/10 bg-white py-4 text-sm text-ink/70 transition hover:border-ink/40"
                >
                  <Icon name={m.icon} width={20} height={20} />
                  {m.label}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="mt-10 text-center text-xs text-ink/60">{s.demo}</p>
      </div>
    </IntakeFrame>
  );
}
