"use client";

import { Icon } from "./icons";
import { Lang } from "@/lib/intake-schema";
import { STR } from "@/lib/strings";
import { primeAudio } from "@/lib/use-speech";

// On every screen: Back on the left; language + read-aloud on the right. Both
// toggles are real buttons with aria-pressed so a screen reader knows the state.

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
  return (
    <div className="flex items-center justify-between gap-2">
      {onBack ? (
        <button className="btn-ghost -ml-4 flex items-center gap-1" onClick={onBack}>
          <Icon name="arrow-left" width={18} height={18} />
          {s.back}
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
                lang === l ? "bg-white font-medium text-ink shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              {l === "en" ? "EN" : "हिंदी"}
            </button>
          ))}
        </div>
        <button
          aria-pressed={readAloud}
          aria-label={s.readAloud}
          title={s.readAloud}
          onClick={() => {
            // The tap that turns read-aloud on is what unlocks audio playback on iOS.
            if (!readAloud) primeAudio();
            setReadAloud(!readAloud);
          }}
          className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
            readAloud ? "bg-ink text-white" : "bg-black/5 text-ink/60 hover:text-ink"
          }`}
        >
          <Icon name="speaker" width={20} height={20} />
        </button>
      </div>
    </div>
  );
}
