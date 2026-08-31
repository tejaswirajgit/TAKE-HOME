"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "./intake-schema";

// Read-aloud. Sarvam's Indian voices via /api/tts, with the browser's own
// speechSynthesis as the free fallback when the route is slow or missing. One
// shared <audio> element, unlocked by the tap that turned the feature on (iOS).

let audio: HTMLAudioElement | null = null;
const cache = new Map<string, string>(); // text+lang → object URL
// 0.1s of silence — played inside a user gesture to unlock audio on iOS.
const SILENCE =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

function getAudio() {
  if (!audio && typeof window !== "undefined") {
    audio = new Audio();
    audio.preload = "auto";
  }
  return audio;
}

/** Call from a tap handler once so later programmatic playback is allowed. */
export function primeAudio() {
  const a = getAudio();
  if (!a) return;
  a.src = SILENCE;
  a.play().catch(() => {});
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

export function useSpeech(enabled: boolean) {
  const [speaking, setSpeaking] = useState(false);
  const seq = useRef(0);

  const stop = useCallback(() => {
    seq.current += 1;
    const a = getAudio();
    if (a) {
      a.pause();
      a.onended = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    setSpeaking(false);
  }, []);

  const fallback = useCallback((text: string, lang: Lang, mine: number) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    const tag = lang === "hi" ? "hi-IN" : "en-IN";
    u.lang = tag;
    const voice = synth.getVoices().find((v) => v.lang.replace("_", "-").toLowerCase() === tag.toLowerCase());
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = () => mine === seq.current && setSpeaking(false);
    synth.cancel();
    synth.speak(u);
  }, []);

  const speak = useCallback(
    async (text: string, lang: Lang) => {
      stop();
      if (!enabled || !text) return;
      const mine = seq.current;
      setSpeaking(true);
      const key = `${lang}|${text}`;
      try {
        let url = cache.get(key);
        if (!url) {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, lang }),
            signal: AbortSignal.timeout(4000),
          });
          if (!res.ok) throw new Error(String(res.status));
          url = URL.createObjectURL(await res.blob());
          // Small LRU-ish cap so one-off "Heard: …" lines don't pile up blobs.
          if (cache.size >= 24) {
            const [oldKey, oldUrl] = cache.entries().next().value as [string, string];
            URL.revokeObjectURL(oldUrl);
            cache.delete(oldKey);
          }
          cache.set(key, url);
        }
        if (mine !== seq.current) return;
        const a = getAudio();
        if (!a) throw new Error("no audio");
        a.src = url;
        a.onended = () => mine === seq.current && setSpeaking(false);
        await a.play();
      } catch {
        if (mine === seq.current) fallback(text, lang, mine);
      }
    },
    [enabled, stop, fallback]
  );

  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  return { speak, stop, speaking };
}
