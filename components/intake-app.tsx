"use client";

import { useIntake } from "@/lib/use-intake";
import { Welcome } from "./welcome";
import { QuestionScreen } from "./question-screen";
import { FilledForm } from "./filled-form";
import { CompletionScreen } from "./completion-screen";

// The whole patient journey on one route. Nothing renders until localStorage
// has been read, so a resumed intake never flashes the welcome first.

export function IntakeApp() {
  const intake = useIntake();
  if (!intake.hydrated) return null;
  switch (intake.stage) {
    case "questions":
      return intake.current ? <QuestionScreen intake={intake} /> : <Welcome intake={intake} />;
    case "review":
      return <FilledForm intake={intake} />;
    case "done":
      return <CompletionScreen intake={intake} />;
    default:
      return <Welcome intake={intake} />;
  }
}
