# The intake that fills itself

A hair & scalp clinic's 16-question intake, rebuilt so a patient finishes it on a phone in about two minutes — tap or speak, in English or हिंदी — and the doctor gets a complete, structured picture before the consultation starts.

**Live:** https://haiku-intake-nu.vercel.app · **Verify the fill:** `corepack pnpm verify`

---

## What the patient sees

One route, one calm column, one question per screen. Every patient sees the same 16 questions in the clinic's order; the app never asks anything the paper form doesn't.

| The question | How it gets answered |
|---|---|
| 1 · Age hair loss began | Decade chips (Teens · 20s · 30s · 40s · 50+) seed a −/+ stepper; two typed digits drop the keyboard so the button is never hidden. |
| 2, 15 · single choice | One tap, advances. |
| 3, 4, 5, 10 · multi choice | Chips + Continue. "None of these" stands alone and advances in one tap. |
| 6 · Menstrual cycle | Asked to everyone, "Not applicable" is the first chip — no sex question anywhere. |
| 7 · Pregnancy-related | Asked to everyone; **inferred** only when Q6 was Menopausal ("Not applicable" pre-selected, one tap to confirm, any other chip overrides). Q6 = "Not applicable" deliberately infers nothing — a pregnant or breastfeeding patient has no periods either, and this is her question. |
| 8, 9 · yes / no | Two big chips, advances. |
| 11 · Habits | One flowing screen of six rows; smoking "yes" reveals how many, salon "yes" reveals a text field with dictation. The button reads "3 left" and jumps to the missed row instead of going dead. |
| 12 · Products, 13 · Procedures | **Picker, then one small card per pick.** "None of these" fills all rows in one tap; unpicked rows are exported as `used: false`. A 20-cell table becomes ~3 taps for most people. |
| 14 · Side effects / poor response | **Inferred** from 12/13: any side effect or "didn't help" pre-selects Yes with an editable, seeded description; nothing tried pre-selects No. Always one tap to confirm. |
| 16 · Consent | Plain-language sentence naming the sample chosen in Q15; nothing pre-selected, no auto-advance. |

Then the **review screen** — the filled form, sections A–E, with Edit on every row and the schema-aligned JSON visible and copyable — and a done screen: *"Bas ho gaya. The doctor has your full picture. Please have a seat."*

Progress is honest (`n / 16`), answers autosave on-device so a patient can put the phone down and resume, and nothing is ever committed from an inference or a spoken answer without a tap (or, in Voice mode, a spoken yes).

### Tap or Voice — the switch is in the top bar
- **Tap** (default): chips and buttons. **🎤 Speak your answer** still appears where speaking beats tapping (the number, the multi-selects, the two pickers) and as dictation inside text fields.
- **Voice**: for someone who is blind, low-vision, or simply tired of tapping. Every question and its options are read aloud in the chosen language (Sarvam `bulbul:v3`); when the reading ends the mic opens by itself and closes after ~1.2 s of silence; the app reads back what it understood ("Heard: Father, Siblings. Say yes to confirm, or say your answer again"); **"haan" / "yes" confirms, "nahi" redoes**, anything else is taken as a new answer. Answers can be the option itself in English, Hinglish or Hindi ("papa aur bhai", "lagu nahi hota"), or its number as read out ("option 2", "teesra", "last"). Something that is not an option ("uncle") gets the options read back with their numbers rather than a bare "didn't catch that"; "pata nahi" is never turned into a "no". The question and its chips stay on screen the whole time, so a caregiver can follow along and any tap still wins. After two misses the mic stops re-opening on its own — the pill and the chips are still there.
- Both are a fast lane, never a trap: nothing is committed from a spoken answer or an inference without a tap or a spoken yes, and the mic disappears only when it truly can't work here (no microphone, no key, insecure page); a blocked permission or a failed call is shown with the way out and simply retried — in Voice mode that line is read aloud too.

### Accessible by design
Radio/checkbox semantics on every chip, focus moves to each new question, live regions announce what was heard and copied, a skip link, visible focus rings, pinch-zoom left on, 60 px targets, reduced-motion respected. A laptop can drive the whole intake with **1–9**, **Enter** and **Backspace**. A blind or low-vision patient can finish it alone with a screen reader, or with read-aloud + voice.

## Choices (what I bought, what I built, and why)

| Area | Choice | Why |
|---|---|---|
| Framework | Next.js 15 · React 19 · Tailwind · TypeScript | One static page + three tiny serverless routes; zero-config Vercel deploy. |
| Speech → text | **Sarvam AI `saaras:v3`**, `mode: translit` | Built for Indian languages and Hinglish. `translit` returns romanized text ("pachees saal") so the free rule parser can read it. |
| Text → answer | **Rules first** (`lib/voice-parse.ts`), then **Sarvam `sarvam-105b-conversations`** with `json_schema` output (`/api/parse`) | Most utterances resolve offline for free with token-matched Hinglish synonyms ("papa aur bhai" → father, siblings). The LLM is called only when rules give up, and is constrained to the question's own option values — it cannot invent. |
| Text → speech | **Sarvam `bulbul:v3`** with browser `speechSynthesis` fallback | Natural Hindi/English voices; falls back to the device voice if the route is slow. Pinned to one speaker (`shubh`) so the voice never changes between questions or languages; the browser voice is only a fallback after 9 s. |
| Persistence | `localStorage` | On-device, no account, nothing leaves the browser. |
| Vendor seam | `lib/voice.ts` is the only file that knows Sarvam | Swap STT/LLM/TTS by editing one file; the UI never sees a key. |

Bought: the platform, the speech models, the hosting. Built: the schema-driven flow engine, per-question controls, inference-then-confirm, the Hinglish parser, the review/export, and the verification.

**Why no sex question:** the form's Q6 and Q7 already carry "Not applicable". Asking everyone both (with that chip first on Q6) keeps 16/16 coverage without collecting anything the form doesn't ask for — two taps for a man, and no wrong inference for a pregnant woman.

## How I checked the form actually gets filled

`corepack pnpm verify` (`scripts/verify-fill.ts`) pushes two made-up patients — **Priya, 34, PCOS, smoker** and **Rajesh, 58, diabetic, one transplant** — through the *same pure functions the app uses* (`lib/flow.ts`) and asserts: every step answered; every key, row and column of the clinic's official schema (`lib/intake-schema.json`, from haikustudio.ai) present; every exported value in that schema's option lists; follow-ups present exactly when triggered; Q6/Q7 "Not applicable" for Rajesh; the inference firing where expected; a table of Hinglish utterances parsed correctly; and the exported JSON matching checked-in snapshots (`scripts/fixtures/expected-*.json`). 210 checks.

The review screen and the JSON export render from one answers object through the same functions, so what you see on the review is literally what is exported.

**The parser has its own table** (`scripts/verify-parser.ts`, also run by `pnpm verify`): 295 utterances covering every option of every voice question — English, Hinglish, romanized Hindi, "option 2" / ordinals / "last" — plus the things that must *not* match ("uncle", "chacha", "bp hai", "pata nahi", "band nahi hue"), which the free layer settles itself instead of guessing. That last part matters: the live LLM mapped "chacha ko" (paternal uncle) to *Siblings* with high confidence, so relatives and conditions that are not options now short-circuit in the rules and never reach the model — the patient hears the options read back instead.

**Live voice checks against a real key (31 Aug):** `/api/tts` returns a `bulbul:v3` WAV in both languages in about a second. Feeding that Hindi WAV back into `/api/stt` gave `Haan, papa ko bhi tha aur bhai ko bhi.` — romanized, exactly what the rule layer expects — and the rules mapped it to Father + Siblings without calling the LLM. `/api/parse` on seven Hinglish transcripts the rules cannot read ("band nahi hue abhi, do teen saal se chal raha hai" → more than 1 year; "thoda bahut pimple aa jaate hain kabhi kabhi" → yes; "mausam bahut garam hai aaj" → no verdict) came back 7/7 correct, each under 1.4 s. The whole Voice-mode loop was then driven end to end in headless Edge with that Hindi WAV playing as a fake microphone: Q3 read aloud → mic opened by itself → the clip recorded as webm/opus, transcribed, mapped to Father + Siblings and read back → the next "haan" confirmed it → Q4 read aloud before the mic opened again. That run caught a real bug: Sarvam rejects the multipart content type MediaRecorder reports (`audio/webm;codecs=opus`) and accepts the bare `audio/webm`, so `transcribe()` strips the codec parameter. Another finding: plain `sarvam-105b` is a reasoning model and spent 9 s+ thinking before writing its JSON, so the fallback uses `sarvam-105b-conversations`, which answers in about a second.

## Run it

```bash
corepack pnpm install
cp .env.example .env.local     # add SARVAM_API_KEY — optional; without it the mic and read-aloud hide themselves
corepack pnpm dev              # http://localhost:3000
corepack pnpm verify           # the fill check above
corepack pnpm build
```

Deploy: Vercel, one project imported from this repo (Next.js preset, root `./`, pnpm from the lockfile), env var `SARVAM_API_KEY` for Production + Preview; every push to `main` redeploys. Live at https://haiku-intake-nu.vercel.app — after deploying, the three routes were checked against the live URL: `/api/stt` health, TTS in both languages, a real MediaRecorder webm clip transcribed, and the LLM parse. No real personal data anywhere; all patients are made up.

## What I'd do with one more week
- WhatsApp pre-visit link with a signed resume token, so the waiting room becomes a confirm.
- Printable PDF of the review + an EMR webhook that POSTs the schema JSON on Finish, inferred rows flagged for the doctor.
- Scalp photo capture on Q4, attached to the pattern row.
- Per-question drop-off and dwell analytics to find where 55-year-olds stall — then five usability sessions with real patients and low-vision users.
- A small classifier fine-tuned on collected Hinglish transcripts to replace the LLM fallback; streaming STT for true hands-free.
- Marathi / Tamil strings; an attendant mode recorded in the export.

---

UI scaffold (palette, type ramp, chip and stepper components) started from Ankur Sinha's `haiku-intake`, used with his permission; everything the form does — the schema, flow, inference, voice, review, export and verification — is built here.
