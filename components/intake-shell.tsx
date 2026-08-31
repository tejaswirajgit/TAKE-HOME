"use client";

import { ReactNode } from "react";
import { Icon, IconName } from "./icons";
import { TOTAL } from "@/lib/intake-schema";

// The chrome around every question: progress, section eyebrow, the frame and
// the sticky bottom button that is always within thumb reach.

export function ProgressBar({
  n,
  sub,
  label,
}: {
  n: number;
  /** card i of the picked rows for this question */
  sub?: { i: number; of: number };
  label: string;
}) {
  const frac = (n - 1 + (sub ? sub.i / (sub.of + 1) : 0)) / TOTAL;
  return (
    <div className="mt-3 flex items-center gap-3">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={TOTAL}
        aria-valuenow={n}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-ink transition-all duration-500 ease-out"
          style={{ width: `${Math.round(frac * 100)}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-xs tabular-nums text-ink/60" aria-hidden>
        {n} / {TOTAL}
        {sub ? ` · ${sub.i}/${sub.of}` : ""}
      </span>
    </div>
  );
}

export function SectionBadge({ icon, label }: { icon: IconName; label: string }) {
  return (
    <div className="eyebrow inline-flex items-center gap-2">
      <Icon name={icon} width={14} height={14} />
      {label}
    </div>
  );
}

/** Full-height, phone-first frame that widens gently on a laptop. */
export function IntakeFrame({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className={`frame flex min-h-dvh flex-col px-5 py-5 ${wide ? "md:max-w-3xl" : ""}`}>{children}</main>
  );
}

/** The sticky bottom CTA — one clear next action, never a dead end. */
export function StickyNext({
  onClick,
  enabled,
  label,
  hint,
  wide,
}: {
  onClick: () => void;
  enabled: boolean;
  label: string;
  /** shown on the disabled button so the patient knows what to do */
  hint?: string;
  wide?: boolean;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
      <div
        className={`frame bg-gradient-to-t from-paper via-paper/95 to-transparent px-5 pb-5 pt-6 ${
          wide ? "md:max-w-3xl" : ""
        }`}
      >
        <button className="btn-primary pointer-events-auto w-full" onClick={onClick} disabled={!enabled}>
          {enabled ? label : hint ?? label}
        </button>
      </div>
    </div>
  );
}
