import { isKeyable } from "@/modules/element";
import type { FieldAction, PanelSubject } from "@/modules/inspector";
import { KeyControls } from "./KeyControls";

/** What `KeyAction` reads of a row: its clip and paths. */
interface KeyActionProps {
  clip: PanelSubject;
  paths: readonly string[];
  disabled?: boolean;
}

/**
 * The key controls of a row, for a module that draws its own rows (the inspector's field
 * action is this too).
 */
export function KeyAction({ clip, paths, disabled }: KeyActionProps) {
  return <KeyControls clipId={clip.id} paths={paths} disabled={disabled} />;
}

/** The keyframe field action: shows for every field that can hold keys. */
export const keyAction: FieldAction = {
  id: "keyframe.key",
  order: 10,
  appliesTo: isKeyable,
  component: KeyAction,
};
