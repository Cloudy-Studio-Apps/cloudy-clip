import { useStore } from "zustand";
import { useModule } from "@/core";
import { LetterToggle } from "@/ui";
import { modeName, nextMode } from "../../logic/automation";
import { soundRef } from "../../sound.ref";
import type { LineTarget } from "../../sound.types";

/**
 * Under a strip's fader: the automation mode of a track or the master, named (Read, Touch,
 * Latch); a click goes to the next. On (in `--mark`) while the fader writes the line, Touch or
 * Latch.
 */
export function ReadButton({ target }: { target: LineTarget }) {
  const sound = useModule(soundRef);
  const mode = useStore(sound.view, (s) => s.automation[target] ?? "read");
  const name = modeName(mode);
  return (
    <LetterToggle
      on={mode !== "read"}
      label={`Automation: ${name}. ${MODE_HINT[mode]} Click for ${modeName(nextMode(mode))}.`}
      tone="mark"
      onToggle={() => sound.setAutomation(target, nextMode(mode))}
    >
      {name}
    </LetterToggle>
  );
}

/** What each mode does, for the tooltip. */
const MODE_HINT = {
  read: "The fader plays the volume line.",
  touch: "Holding the fader while playing writes the line; letting go returns to it.",
  latch: "The first touch while playing writes the line until playback stops.",
} as const;
