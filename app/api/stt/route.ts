import { NextResponse } from "next/server";
import { hasKey, transcribe } from "@/lib/voice";

export const runtime = "nodejs";

/** Health check the client uses to decide whether to show the mic at all. */
export async function GET() {
  return NextResponse.json({ ok: hasKey() });
}

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  if (!hasKey()) return NextResponse.json({ error: "no key" }, { status: 503 });
  let file: File | null = null;
  try {
    const fd = await req.formData();
    const f = fd.get("file");
    if (f instanceof File) file = f;
  } catch {
    /* fallthrough */
  }
  if (!file || file.size < 1000) return NextResponse.json({ error: "no audio" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });
  try {
    const transcript = await transcribe(file, file.name || "clip.webm", AbortSignal.timeout(10_000));
    return NextResponse.json({ transcript });
  } catch (e) {
    console.error("[stt]", (e as Error).message);
    return NextResponse.json({ error: "stt failed" }, { status: 502 });
  }
}
