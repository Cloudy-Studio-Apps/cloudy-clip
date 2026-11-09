import { useStore } from "zustand";
import { useModule } from "@/core";
import { LetterToggle } from "@/ui";
import { modeName, nextMode } from "../../logic/automation";
import { soundRef } from "../../sound.ref";
import type { MixTarget } from "../../sound.types";
import { soon } from "../soon";

/**
 * Under a strip's fader: the track's automation mode, named (Read, Touch, Latch); a click goes to
 * the next. On (in `--mark`) while the fader writes the line, Touch or Latch. The master's Read
 * (`master.read`) comes in stage 4: drawn off, does nothing.
 */
export function ReadButton({ target }: { target: MixTarget }) {
  const sound = useModule(soundRef);
  const mode = useStore(sound.view, (s) =>
    target === "master" ? "read" : (s.automation[target] ?? "read"),
  );
  if (target === "master") {
    const props = soon("master.read");
    return (
      <LetterToggle on={false} label="Read" tone="mark" onToggle={props.onClick} {...props}>
        Read
      </LetterToggle>
    );
  }
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
