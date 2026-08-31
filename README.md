# The intake that fills itself

A 16-question hair & scalp clinic intake a patient can finish on a phone in about two minutes — tap or speak, in English or Hindi — that hands the doctor a complete, structured picture before the consultation.

Live link and full write-up coming with the final commit.

## Run

```bash
corepack pnpm install
cp .env.example .env.local   # add SARVAM_API_KEY (voice is optional — the app works fully by tapping)
corepack pnpm dev            # http://localhost:3000
corepack pnpm verify         # proves two made-up patients fill all 16 questions against the clinic schema
```
