"use client";

import { Icon } from "./icons";
import { Lang } from "@/lib/intake-schema";
import { STR } from "@/lib/strings";
import { primeAudio } from "@/lib/use-speech";
import { primeMic } from "@/lib/use-voice";

// On every screen: Back on the left; language and Tap | Voice on the right.
// Voice = every question read aloud, the mic opens by itself, "haan" confirms.
// Both switches are real buttons with aria-pressed so a screen reader knows the state.

export function TopBar({
  onBack,
  lang,
  setLang,
  readAloud,
  setReadAloud,
}: {
  onBack?: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  readAloud: boolean;
  setReadAloud: (v: boolean) => void;
}) {
  const s = STR[lang];
  const modes = [
    { voice: false, icon: "tap" as const, label: s.tap },
    { voice: true, icon: "mic" as const, label: s.voice },
  ];
  return (
    <div className="flex items-center justify-between gap-2">
      {onBack ? (
        <button className="btn-ghost -ml-4 flex items-center gap-1" onClick={onBack} aria-label={s.back}>
          <Icon name="arrow-left" width={18} height={18} />
          <span className="hidden sm:inline">{s.back}</span>
        </button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <div role="group" aria-label={s.language} className="flex rounded-full bg-black/5 p-1 text-sm">
          {(["en", "hi"] as Lang[]).map((l) => (
            <button
              key={l}
              lang={l}
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={`min-h-[36px] rounded-full px-3 transition ${
                lang === l ? "bg-white font-medium text-ink shadow-sm" : "text-ink/60 hover:text-ink"
              }`}
            >
              {l === "en" ? "EN" : "हिंदी"}
            </button>
          ))}
        </div>
        <div role="group" aria-label={s.mode} className="flex rounded-full bg-black/5 p-1 text-sm">
          {modes.map((m) => (
            <button
              key={m.label}
              aria-pressed={readAloud === m.voice}
              onClick={() => {
                // The tap that turns Voice on unlocks audio playback (iOS) and asks for the mic once.
                if (m.voice && !readAloud) {
                  primeAudio();
                  primeMic();
                }
                setReadAloud(m.voice);
              }}
              className={`flex min-h-[36px] items-center gap-1 rounded-full px-2.5 transition ${
                readAloud === m.voice ? "bg-white font-medium text-ink shadow-sm" : "text-ink/60 hover:text-ink"
              }`}
            >
              <Icon name={m.icon} width={15} height={15} />
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
