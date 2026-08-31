"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Tap to record, tap to stop; the clip goes to /api/stt and the transcript
// comes back to the caller. The mic hides itself only when it truly can't
// work (no permission, no recorder, no key) or after two server failures —
// one slow call must never take voice away for the whole visit.

export type VoiceStatus = "idle" | "recording" | "transcribing";

export interface Voice {
  /** null until checked; false hides the mic for the session */
  available: boolean | null;
  status: VoiceStatus;
  seconds: number;
  /** a one-line problem to show once ("didn't catch that") */
  problem: "short" | "failed" | null;
  start: () => void;
  stop: () => void;
  cancel: () => void;
}

const MAX_MS = 15_000;
const MIN_MS = 700;

let healthPromise: Promise<boolean> | null = null;
const checkHealth = () => {
  healthPromise ??= fetch("/api/stt")
    .then((r) => r.json())
    .then((j) => !!j.ok)
    .catch(() => false);
  return healthPromise;
};
let sessionAvailable: boolean | null = null;
let failures = 0;
// One recorder at a time across every MicButton on the page (pill + dictation).
let active = false;

export function useVoice(onTranscript: (text: string) => void): Voice {
  const [available, setAvailable] = useState<boolean | null>(sessionAvailable);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [problem, setProblem] = useState<Voice["problem"]>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const timers = useRef<number[]>([]);
  const cb = useRef(onTranscript);
  cb.current = onTranscript;

  useEffect(() => {
    if (sessionAvailable !== null) return;
    const supported =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined" &&
      window.isSecureContext;
    if (!supported) {
      sessionAvailable = false;
      setAvailable(false);
      return;
    }
    checkHealth().then((ok) => {
      sessionAvailable = ok;
      setAvailable(ok);
    });
  }, []);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const disable = () => {
    sessionAvailable = false;
    setAvailable(false);
  };

  const upload = useCallback(async (blob: Blob, ext: string) => {
    if (blob.size < 2000) {
      setProblem("short");
      setStatus("idle");
      return;
    }
    setStatus("transcribing");
    const fd = new FormData();
    fd.append("file", blob, `clip.${ext}`);
    const ac = new AbortController();
    abort.current = ac;
    const t = window.setTimeout(() => ac.abort(), 12_000);
    try {
      const res = await fetch("/api/stt", { method: "POST", body: fd, signal: ac.signal });
      if (!res.ok) throw new Error(String(res.status));
      const { transcript } = (await res.json()) as { transcript?: string };
      failures = 0;
      if (!cancelled.current) {
        if (transcript) cb.current(transcript);
        else setProblem("short");
      }
    } catch {
      if (!cancelled.current) {
        failures += 1;
        if (failures >= 2) disable();
        else setProblem("failed");
      }
    } finally {
      window.clearTimeout(t);
      abort.current = null;
      setStatus("idle");
    }
  }, []);

  const start = useCallback(() => {
    // Synchronous guard: a double-tap must not open a second recorder.
    if (status !== "idle" || active || rec.current) return;
    active = true;
    setProblem(null);
    cancelled.current = false;
    chunks.current = [];
    // getUserMedia must be the first call in the tap handler (iOS gesture rule).
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled.current) {
          stream.getTracks().forEach((tr) => tr.stop());
          active = false;
          return;
        }
        let r: MediaRecorder;
        try {
          r = new MediaRecorder(stream); // no mimeType: Safari picks audio/mp4, Chrome webm/opus
        } catch {
          stream.getTracks().forEach((tr) => tr.stop());
          active = false;
          disable();
          return;
        }
        rec.current = r;
        r.ondataavailable = (e) => {
          if (e.data.size) chunks.current.push(e.data);
        };
        r.onstop = () => {
          stream.getTracks().forEach((tr) => tr.stop());
          clearTimers();
          const type = r.mimeType || "audio/webm";
          const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
          const blob = new Blob(chunks.current, { type });
          rec.current = null;
          active = false;
          if (cancelled.current) {
            setStatus("idle");
            return;
          }
          void upload(blob, ext);
        };
        r.start(250);
        startedAt.current = Date.now();
        setSeconds(0);
        setStatus("recording");
        timers.current.push(
          window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 500) as unknown as number,
          window.setTimeout(() => r.state === "recording" && r.stop(), MAX_MS)
        );
      })
      .catch((err: DOMException) => {
        active = false;
        if (err?.name === "NotAllowedError" || err?.name === "NotFoundError" || err?.name === "SecurityError") disable();
        else setProblem("failed");
      });
  }, [status, upload]);

  const stop = useCallback(() => {
    const r = rec.current;
    if (!r || r.state !== "recording") return;
    const wait = Math.max(0, MIN_MS - (Date.now() - startedAt.current));
    window.setTimeout(() => r.state === "recording" && r.stop(), wait);
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    abort.current?.abort();
    const r = rec.current;
    if (r && r.state === "recording") r.stop();
    else active = false;
    clearTimers();
    setStatus("idle");
  }, []);

  useEffect(() => () => cancel(), [cancel]);

  return { available, status, seconds, problem, start, stop, cancel };
}
