import type { ComponentType } from "react";

/** Where a panel sits in the editor layout. */
export type LayoutSlot = "side" | "main" | "bottom";

/** A panel a module adds to the editor. */
export interface LayoutPanel {
  /** Unique id, `<module>.<name>`. */
  id: string;
  /** Shown in error messages and, later, in tabs. */
  title: string;
  slot: LayoutSlot;
  /** Lower comes first within a slot. Defaults to 0. */
  order?: number;
  component: ComponentType;
}

/** The parts of a `KeyboardEvent` keybindings match on. */
export interface KeyPress {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/** The command a keybinding runs. */
export interface KeybindingAction {
  command: string;
  input: unknown;
}

/** A keyboard shortcut that runs a command, so shortcuts, buttons and agents share one path. */
export interface Keybinding {
  /** Unique id, `<module>.<name>`. */
  id: string;
  /** `KeyboardEvent.key`, lowercased (`" "` for space). */
  key: string;
  /** Ctrl on Linux and Windows, Cmd on macOS. */
  mod?: boolean;
  shift?: boolean;
  /** Builds the command at press time. Returning null ignores the press. */
  resolve(): KeybindingAction | null;
}
