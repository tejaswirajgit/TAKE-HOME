// Server-only. The one file that knows the voice vendor (Sarvam AI). The UI
// never calls Sarvam directly and never sees the key; swapping providers means
// editing this file and nothing else.

const KEY = () => process.env.SARVAM_API_KEY ?? "";
export const hasKey = () => KEY().length > 0;

const STT_URL = "https://api.sarvam.ai/speech-to-text";
const CHAT_URL = "https://api.sarvam.ai/v1/chat/completions";
const TTS_URL = "https://api.sarvam.ai/text-to-speech";

/** Speech → romanized text. `translit` keeps Hindi in Latin script ("pachees saal")
 *  so the free rule parser can read it. Language is auto-detected. */
export async function transcribe(file: Blob, filename: string, signal?: AbortSignal): Promise<string> {
  const fd = new FormData();
  // Sarvam validates the part's content type and rejects MediaRecorder's exact
  // string ("audio/webm;codecs=opus"); the bare type ("audio/webm") is accepted.
  fd.append("file", new Blob([file], { type: file.type.split(";")[0] }), filename);
  fd.append("model", "saaras:v3");
  fd.append("mode", "translit");
  fd.append("language_code", "unknown");
  // No Content-Type header: fetch sets the multipart boundary itself.
  const res = await fetch(STT_URL, { method: "POST", headers: { "api-subscription-key": KEY() }, body: fd, signal });
  if (!res.ok) throw new Error(`stt ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { transcript?: string };
  return (j.transcript ?? "").trim();
}

export interface ClassifyInput {
  prompt: string;
  kind: "single" | "multi" | "yesno";
  options: { value: string; label: string; hi?: string }[];
  transcript: string;
}
export interface Verdict {
  values: string[];
  confidence: "high" | "low";
}

/** Transcript → option values, only when the rule parser gave up. Constrained
 *  to the question's own option values via json_schema, so it cannot invent. */
export async function classify(input: ClassifyInput, signal?: AbortSignal): Promise<Verdict> {
  const allowed = input.options.map((o) => o.value);
  const schema = {
    type: "object",
    properties: {
      values: { type: "array", items: { type: "string", enum: allowed } },
      confidence: { type: "string", enum: ["high", "low"] },
    },
    required: ["values", "confidence"],
    additionalProperties: false,
  };
  const system =
    "You map what a patient said (Hinglish, Hindi or English, often romanized) to the options of ONE question on a hair-clinic intake form. " +
    (input.kind === "multi" ? "Several values may apply." : "Pick at most one value.") +
    ' Only choose values the patient clearly meant. If the answer is unclear, unrelated, or you would be guessing, return an empty values array with confidence "low". Never invent. Respond with JSON only.';
  const user =
    `Question: ${input.prompt}\nOptions (value = label / Hindi):\n` +
    input.options.map((o) => `- ${o.value} = ${o.label}${o.hi ? ` / ${o.hi}` : ""}`).join("\n") +
    `\nPatient said: "${input.transcript}"`;
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY()}`, "api-subscription-key": KEY(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sarvam-105b-conversations", // plain 105b is a reasoning model: 9 s+ before the JSON; this one answers in ~1 s
      temperature: 0,
      max_tokens: 300,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name: "verdict", schema, strict: true } },
    }),
    signal,
  });
  if (!res.ok) throw new Error(`parse ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = j.choices?.[0]?.message?.content ?? "{}";
  let parsed: Partial<Verdict> = {};
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "").trim());
  } catch {
    /* model returned non-JSON → treated as no verdict */
  }
  const values = Array.isArray(parsed.values) ? parsed.values.filter((v) => allowed.includes(v)) : [];
  return { values, confidence: parsed.confidence === "high" && values.length ? "high" : "low" };
}

/** Text → WAV bytes in the patient's language. */
export async function speak(text: string, lang: "en" | "hi", signal?: AbortSignal): Promise<Buffer> {
  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: { "api-subscription-key": KEY(), "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text.slice(0, 1500),
      language_code: lang === "hi" ? "hi-IN" : "en-IN",
      model: "bulbul:v3",
      speaker: "shubh", // pinned: one voice for the whole visit, in both languages
      speech_sample_rate: 22050,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`tts ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { audios?: string[] };
  if (!j.audios?.[0]) throw new Error("tts: empty audio");
  return Buffer.from(j.audios[0], "base64");
}
