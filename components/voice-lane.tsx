"use client";

import { Lang } from "@/lib/intake-schema";
import { STR } from "@/lib/strings";
import { useVoice } from "@/lib/use-voice";
import { Icon } from "./icons";

// The mic. As a pill under the question ("Speak your answer") or as a small
// round dictation button inside a text field. Chips stay the primary control;
// this is the fast lane, never a trap — it disappears when it can't work.

export function MicButton({
  lang,
  onTranscript,
  compact,
}: {
  lang: Lang;
  onTranscript: (text: string) => void;
  compact?: boolean;
}) {
  const s = STR[lang];
  const voice = useVoice(onTranscript);
  // Nothing until we know the mic can actually work — no flash of a control that then vanishes.
  if (voice.available !== true) return null;
  const busy = voice.status === "transcribing";
  const rec = voice.status === "recording";
  const label = rec ? `${s.listening} · 0:${String(voice.seconds).padStart(2, "0")}` : busy ? s.transcribing : compact ? s.dictate : s.speak;
  const onClick = () => (rec ? voice.stop() : busy ? undefined : voice.start());

  if (compact)
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={rec}
        title={label}
        onClick={onClick}
        disabled={busy}
        className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
          rec ? "animate-pulse bg-ink text-white" : busy ? "bg-black/10 text-ink/60" : "bg-black/5 text-ink/70 hover:bg-black/10"
        }`}
      >
        <Icon name="mic" width={20} height={20} />
      </button>
    );

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-pressed={rec}
          onClick={onClick}
          disabled={busy}
          className={`pill ${rec ? "animate-pulse border-ink bg-ink text-white" : busy ? "text-ink/60" : ""}`}
        >
          <Icon name="mic" width={18} height={18} />
          <span aria-live="polite">{label}</span>
        </button>
        <span className="text-sm text-ink/60">{s.orTap}</span>
      </div>
      {voice.problem && (
        <p role="status" className="mt-2 text-sm text-ink/60">
          {voice.problem === "short" ? s.tryAgain : s.tryAgain}
        </p>
      )}
    </div>
  );
}
