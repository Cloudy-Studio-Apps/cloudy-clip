import { LetterToggle } from "@/ui";
import { soon } from "../soon";

/**
 * Read under a strip's fader (`mixer.read`, stage 3) or the master's (`master.read`, stage 4):
 * plays back the volume and pan drawn or recorded there. Coming soon: drawn off, does nothing.
 */
export function ReadButton({ id }: { id: "mixer.read" | "master.read" }) {
  const props = soon(id);
  return (
    <LetterToggle on={false} label="Read" tone="mark" onToggle={props.onClick} {...props}>
      Read
    </LetterToggle>
  );
}
