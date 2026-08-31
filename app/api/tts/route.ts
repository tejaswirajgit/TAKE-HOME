import { NextResponse } from "next/server";
import { hasKey, speak } from "@/lib/voice";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!hasKey()) return NextResponse.json({ error: "no key" }, { status: 503 });
  let text = "";
  let lang: "en" | "hi" = "en";
  try {
    const b = (await req.json()) as { text?: string; lang?: string };
    text = typeof b.text === "string" ? b.text.trim() : "";
    lang = b.lang === "hi" ? "hi" : "en";
  } catch {
    /* fallthrough */
  }
  if (!text || text.length > 1500) return NextResponse.json({ error: "bad text" }, { status: 400 });
  try {
    const wav = await speak(text, lang, AbortSignal.timeout(8_000));
    return new Response(new Uint8Array(wav), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=3600" },
    });
  } catch (e) {
    console.error("[tts]", (e as Error).message);
    return NextResponse.json({ error: "tts failed" }, { status: 502 });
  }
}
