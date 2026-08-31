"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Tap to record, tap to stop; the clip goes to /api/stt and the transcript
// comes back to the caller. The mic hides itself only when it truly cannot
// work here (no microphone, no recorder, no key, insecure page). A blocked
// permission or a failed call is shown with the way out and simply retried —
// one bad call must never take voice away for the whole visit.
// Hands-free (Voice mode): the recorder opens on its own after the question
// is read and closes itself after ~1.2 s of silence, so nobody has to tap.

export type VoiceStatus = "idle" | "recording" | "transcribing";

export interface Voice {
  /** null until checked; false hides the mic for the session */
  available: boolean | null;
  status: VoiceStatus;
  seconds: number;
  /** a one-line problem to show once ("didn't catch that", "mic is blocked") */
  problem: "short" | "failed" | "blocked" | null;
  start: (opts?: { handsFree?: boolean }) => void;
  stop: () => void;
  cancel: () => void;
}

const MAX_MS = 15_000;
const HANDS_FREE_MAX_MS = 10_000;
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
/** What the session knows about the mic: null = not checked yet, false = cannot work here. */
export const micAvailable = () => sessionAvailable;
// One recorder at a time across every MicButton on the page (pill + dictation).
let active = false;

// Ask the browser for its own noise suppression / gain control — the waiting room is loud.
const MIC: MediaStreamConstraints = { audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true } };

/** Ask for the mic inside the tap that turns Voice mode on, so the hands-free
 *  starts that follow need no gesture (and the permission prompt shows now). */
export function primeMic() {
  navigator.mediaDevices
    ?.getUserMedia(MIC)
    .then((s) => s.getTracks().forEach((t) => t.stop()))
    .catch(() => {});
}

export function useVoice(onTranscript: (text: string) => void): Voice {
  const [available, setAvailable] = useState<boolean | null>(sessionAvailable);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [problem, setProblem] = useState<Voice["problem"]>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const silent = useRef(false);
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
      if (!cancelled.current) {
        if (transcript) cb.current(transcript);
        else setProblem("short");
      }
    } catch {
      // A failed call is shown, never punished: the mic stays for the next try.
      if (!cancelled.current) setProblem("failed");
    } finally {
      window.clearTimeout(t);
      abort.current = null;
      setStatus("idle");
    }
  }, []);

  // ponytail: RMS-threshold silence detection; swap for a real VAD if noisy waiting rooms defeat it.
  const watchSilence = (stream: MediaStream, r: MediaRecorder) => {
    let ctx: AudioContext | undefined;
    try {
      ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      let spoke = 0;
      let quietSince = Date.now();
      // Calibrate on the first 300 ms (a waiting room is never silent): the floor is the
      // room, speech must clear 2.5x the room for two frames in a row. Without this,
      // steady noise counted as "speech" and the mic closed before the patient began.
      const calib: number[] = [];
      let noise = 0.01;
      let loud = 0;
      const tick = () => {
        if (r.state !== "recording") {
          ctx?.close().catch(() => {});
          return;
        }
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / buf.length);
        const now = Date.now();
        if (calib.length < 3) {
          calib.push(rms);
          if (calib.length === 3) noise = Math.max(0.01, calib.reduce((a, b) => a + b, 0) / 3);
          quietSince = now;
          window.setTimeout(tick, 100);
          return;
        }
        if (rms > Math.max(0.02, noise * 2.5)) {
          loud += 1;
          if (loud >= 2) {
            spoke ||= now;
            quietSince = now;
          }
        } else {
          loud = 0;
          noise = noise * 0.97 + rms * 0.03; // the room can change; follow it slowly
        }
        if (spoke && now - quietSince > 1200) r.stop();
        else if (!spoke && now - startedAt.current > 5000) {
          silent.current = true; // nothing was said — do not send 5 s of room noise to be transcribed
          r.stop();
        } else window.setTimeout(tick, 100);
      };
      void ctx.resume().catch(() => {});
      tick();
    } catch {
      /* no WebAudio: the max-length timer still closes the mic */
    }
  };

  const start = useCallback(
    (opts?: { handsFree?: boolean }) => {
      // Synchronous guard: a double-tap must not open a second recorder.
      if (status !== "idle" || active || rec.current) return;
      active = true;
      setProblem(null);
      cancelled.current = false;
      silent.current = false;
      chunks.current = [];
      // getUserMedia must be the first call in the tap handler (iOS gesture rule).
      navigator.mediaDevices
        .getUserMedia(MIC)
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
            if (silent.current) {
              setProblem("short");
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
            window.setTimeout(() => r.state === "recording" && r.stop(), opts?.handsFree ? HANDS_FREE_MAX_MS : MAX_MS)
          );
          if (opts?.handsFree) watchSilence(stream, r);
        })
        .catch((err: DOMException) => {
          active = false;
          // Blocked permission is shown with the way out (the address-bar icon) and retried next
          // time; only a missing microphone hides the mic for the session.
          if (err?.name === "NotAllowedError") setProblem("blocked");
          else if (err?.name === "NotFoundError" || err?.name === "SecurityError") disable();
          else setProblem("failed");
        });
    },
    [status, upload]
  );

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
