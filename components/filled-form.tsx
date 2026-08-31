"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Intake } from "@/lib/use-intake";
import { STR } from "@/lib/strings";
import { Lang, SECTIONS, SHORT, Section, tx } from "@/lib/intake-schema";
import { FormRow, buildFilledForm, toSchemaJson } from "@/lib/flow";
import { Icon } from "./icons";
import { StickyNext } from "./intake-shell";
import { TopBar } from "./top-bar";

// The deliverable: the 16-question form, filled, as the doctor will read it.
// Rendered straight from the answers object — the same object Copy JSON
// exports — so a wrong line here means a wrong answer, never a display bug.

export function FilledForm({ intake }: { intake: Intake }) {
  const { answers, lang } = intake;
  const s = STR[lang];
  const rows = useMemo(() => buildFilledForm(answers, lang), [answers, lang]);
  const blanks = rows.filter((r) => !r.answered).length;
  const json = useMemo(() => JSON.stringify(toSchemaJson(answers, lang), null, 2), [answers, lang]);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "selected">("idle");
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => h1.current?.focus(), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopyState("copied");
    } catch {
      // No clipboard (insecure context / older in-app browsers): select the text instead.
      const pre = document.getElementById("json-pre");
      if (pre) {
        const range = document.createRange();
        range.selectNodeContents(pre);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setCopyState("selected");
    }
    setTimeout(() => setCopyState("idle"), 2500);
  };

  const column = (secs: Section[]) =>
    secs.map((sec) => (
      <SectionCard key={sec} sec={sec} rows={rows.filter((r) => r.q.section === sec)} lang={lang} onEdit={intake.edit} />
    ));

  return (
    <main className="frame min-h-dvh px-5 py-5 pb-36 md:max-w-3xl">
      <TopBar lang={lang} setLang={intake.setLang} readAloud={intake.readAloud} setReadAloud={intake.setReadAloud} />
      <header className="mt-4">
        <p className="eyebrow">{s.reviewEyebrow}</p>
        <h1
          ref={h1}
          tabIndex={-1}
          className="mt-2 font-display text-[32px] font-light leading-tight tracking-[-0.01em] outline-none md:text-4xl"
        >
          {s.reviewTitle}
        </h1>
        <p className="mt-2 text-ink/55">{s.reviewBody}</p>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="space-y-5">{column(["A", "B", "C"])}</div>
        <div className="space-y-5">{column(["D", "E"])}</div>
      </div>

      <details className="mt-6 rounded-2xl border border-black/10 bg-white">
        <summary className="cursor-pointer px-5 py-4 text-base font-medium">{s.jsonSummary}</summary>
        <div className="border-t border-black/5 px-5 py-3">
          <button className="pill" onClick={copy}>
            <span aria-live="polite">{copyState === "copied" ? s.copied : copyState === "selected" ? s.selected : s.copy}</span>
          </button>
          <pre id="json-pre" className="mt-3 overflow-x-auto text-xs leading-relaxed text-ink/80">
            {json}
          </pre>
        </div>
      </details>

      <StickyNext wide onClick={intake.finish} enabled={blanks === 0} label={s.looksRight} hint={s.left(blanks)} />
    </main>
  );
}

function SectionCard({
  sec,
  rows,
  lang,
  onEdit,
}: {
  sec: Section;
  rows: FormRow[];
  lang: Lang;
  onEdit: (stepId: string) => void;
}) {
  const s = STR[lang];
  const meta = SECTIONS[sec];
  return (
    <section aria-labelledby={`sec-${sec}`} className="overflow-hidden rounded-2xl border border-black/10 bg-white">
      <header className="flex items-center gap-2 border-b border-black/5 bg-black/[0.02] px-5 py-3">
        <span className="text-sage">
          <Icon name={meta.icon} width={18} height={18} />
        </span>
        <h2 id={`sec-${sec}`} className="font-semibold">
          {tx(lang, meta.title, meta.hi)}
        </h2>
      </header>
      <dl className="divide-y divide-black/5">
        {rows.map((r) => (
          <div key={r.q.id} className="px-5 py-3">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-sm text-ink/60">
                <span className="font-mono text-xs text-ink/40">{r.n}.</span> {tx(lang, SHORT[r.q.id].en, SHORT[r.q.id].hi)}
                {r.inferred && (
                  <span className="ml-2 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink/50">
                    {s.inferredBadge}
                  </span>
                )}
              </dt>
              <button
                className="pill shrink-0 !min-h-[36px] !px-3 !py-1 text-sm"
                aria-label={s.editQ(r.n)}
                onClick={() => onEdit(r.stepId)}
              >
                <Icon name="pencil" width={14} height={14} />
                {s.edit}
              </button>
            </div>
            <dd className={`mt-1 text-base font-medium ${r.answered ? "text-ink" : "text-red-600"}`}>
              {r.lines ? (
                <ul className="mt-1 space-y-1 text-sm">
                  {r.lines.map((l) => (
                    <li key={l.label} className="flex justify-between gap-3">
                      <span className="text-ink/60">{l.label}</span>
                      <span className="text-right font-medium text-ink">{l.value}</span>
                    </li>
                  ))}
                </ul>
              ) : r.answered ? (
                r.value
              ) : (
                s.unanswered
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
