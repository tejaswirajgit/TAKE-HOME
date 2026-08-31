// Inline SVG icons — no icon library dependency (keeps the repo lean and the
// bundle tiny). Each is a simple, friendly line glyph that gives a 55-year-old a
// visual anchor next to the words. Keyed by name so the schema can just say
// `icon: "family"` and the UI resolves it here.

import type { SVGProps } from "react";

type IconName =
  | "female" | "male" | "person"
  | "calendar" | "clock" | "family" | "pattern"
  | "heart" | "cycle" | "baby" | "droplet" | "hair"
  | "leaf" | "cigarette" | "wash" | "water"
  | "food" | "flask" | "target" | "check" | "mic" | "chat" | "tap"
  | "sparkle" | "arrow-right" | "arrow-left" | "speaker" | "pencil";

const paths: Record<IconName, React.ReactNode> = {
  female: <><circle cx="12" cy="8" r="5" /><path d="M12 13v8M9 18h6" /></>,
  male: <><circle cx="10" cy="14" r="5" /><path d="M15 9l5-5M20 4h-4M20 4v4" /></>,
  person: <><circle cx="12" cy="7" r="4" /><path d="M5 21a7 7 0 0114 0" /></>,
  calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  family: <><circle cx="7" cy="8" r="3" /><circle cx="17" cy="8" r="3" /><path d="M2 21a5 5 0 0110 0M12 21a5 5 0 0110 0" /></>,
  pattern: <><path d="M4 6h16M6 12h12M9 18h6" /></>,
  heart: <path d="M12 21s-7-5-9.5-9A5 5 0 0112 5a5 5 0 019.5 7C19 16 12 21 12 21z" />,
  cycle: <><path d="M4 12a8 8 0 018-8 8 8 0 016 3" /><path d="M20 4v4h-4" /><path d="M20 12a8 8 0 01-8 8 8 8 0 01-6-3" /><path d="M4 20v-4h4" /></>,
  baby: <><circle cx="12" cy="7" r="3" /><path d="M6 21c0-4 3-7 6-7s6 3 6 7" /></>,
  droplet: <path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z" />,
  hair: <><path d="M4 20c0-8 4-14 8-14s8 6 8 14" /><path d="M8 20V9M12 20V6M16 20v-9" /></>,
  leaf: <><path d="M21 3s-9-1-14 4-3 12-3 12 7 2 12-3 5-13 5-13z" /><path d="M8 16C12 12 14 9 18 6" /></>,
  cigarette: <><rect x="2" y="12" width="16" height="4" rx="1" /><path d="M20 8c1 1 1 3 0 4M17 7c1 1 1 4 0 5" /></>,
  wash: <><path d="M4 10h16l-1 9a2 2 0 01-2 2H7a2 2 0 01-2-2z" /><path d="M8 10V6a4 4 0 018 0v4" /></>,
  water: <><path d="M3 15c2 0 2 2 4.5 2S10 15 12 15s2 2 4.5 2S19 15 21 15" /><path d="M3 19c2 0 2 2 4.5 2S10 19 12 19s2 2 4.5 2S19 19 21 19" /><path d="M12 3v6" /></>,
  food: <><path d="M4 3v7a3 3 0 006 0V3M7 3v18M17 3c-2 0-3 3-3 6s1 4 3 4v8" /></>,
  flask: <><path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  check: <path d="M4 12l6 6L20 6" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></>,
  chat: <path d="M4 5h16v11H9l-5 4V5z" />,
  tap: <><path d="M9 11V6a2 2 0 014 0v6" /><path d="M13 12V8a2 2 0 014 0v6a6 6 0 01-6 6h-1a5 5 0 01-4-2l-3-4 2-1 2 2" /></>,
  sparkle: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
  speaker: <><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" /></>,
  pencil: <><path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" /><path d="M13 7l3 3" /></>,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
};

export function Icon({
  name,
  ...props
}: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={22}
      height={22}
      aria-hidden
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

export type { IconName };
