import { useClipInfo } from "./clip.info.hook";
import { useCurrentEntry } from "./current.hook";
import { PanelNote } from "./PanelNote";
import type { StripClip } from "../tint.types";

function EntryNote({ entry }: { entry: StripClip }) {
  const { name } = useClipInfo(entry.clip);
  return (
    <PanelNote>
      {entry.no} {name}
    </PanelNote>
  );
}

/** "02 Plaza wide": the clip being graded, in a panel header. */
export function CurrentNote() {
  const entry = useCurrentEntry();
  return entry ? <EntryNote entry={entry} /> : <PanelNote>No clip to grade</PanelNote>;
}
