"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "./intake-schema";

// Read-aloud. Sarvam's Indian voices via /api/tts, with the browser's own
// speechSynthesis as the free fallback when the route is slow or missing. One
// shared <audio> element, unlocked by the tap that turned the feature on (iOS).
// speak() resolves true when the line finished playing and false when it was
// cut off — Voice mode uses that to know when to open the mic.

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
  const pending = useRef<((done: boolean) => void) | null>(null);

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
    pending.current?.(false);
    pending.current = null;
  }, []);

  const fallback = useCallback((text: string, lang: Lang, onEnd: () => void) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return onEnd();
    const u = new SpeechSynthesisUtterance(text);
    const tag = lang === "hi" ? "hi-IN" : "en-IN";
    u.lang = tag;
    const voice = synth.getVoices().find((v) => v.lang.replace("_", "-").toLowerCase() === tag.toLowerCase());
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = onEnd;
    u.onerror = onEnd;
    synth.cancel();
    synth.speak(u);
  }, []);

  const speak = useCallback(
    (text: string, lang: Lang) =>
      new Promise<boolean>((resolve) => {
        stop();
        if (!enabled || !text) return resolve(false);
        const mine = seq.current;
        setSpeaking(true);
        pending.current = resolve;
        const finish = () => {
          if (mine !== seq.current) return;
          setSpeaking(false);
          pending.current = null;
          resolve(true);
        };
        void (async () => {
          const key = `${lang}|${text}`;
          try {
            let url = cache.get(key);
            if (!url) {
              const res = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, lang }),
                // Generous: a cold serverless start must not swap in the browser voice mid-visit.
            signal: AbortSignal.timeout(9000),
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
            a.onended = finish;
            await a.play();
          } catch {
            if (mine === seq.current) fallback(text, lang, finish);
          }
        })();
      }),
    [enabled, stop, fallback]
  );

  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  return { speak, stop, speaking };
}
