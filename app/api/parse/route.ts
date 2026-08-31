import { NextResponse } from "next/server";
import { ClassifyInput, classify, hasKey } from "@/lib/voice";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!hasKey()) return NextResponse.json({ error: "no key" }, { status: 503 });
  let body: ClassifyInput;
  try {
    body = (await req.json()) as ClassifyInput;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const ok =
    body &&
    typeof body.transcript === "string" &&
    body.transcript.length <= 400 &&
    Array.isArray(body.options) &&
    body.options.length > 0 &&
    body.options.length <= 12 &&
    ["single", "multi", "yesno"].includes(body.kind);
  if (!ok) return NextResponse.json({ error: "bad input" }, { status: 400 });
  try {
    const verdict = await classify(body, AbortSignal.timeout(8_000));
    return NextResponse.json(verdict);
  } catch (e) {
    console.error("[parse]", (e as Error).message);
    return NextResponse.json({ values: [], confidence: "low" }, { status: 502 });
  }
}
