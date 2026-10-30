import type { ComponentType } from "react";

/**
 * Where a panel sits in the editor layout. `side` panels become tabs of the left rail, `main`
 * is the center, `inspector` the right column, `bottom` the row below.
 */
export type LayoutSlot = "side" | "main" | "inspector" | "bottom";

/** An icon component, sized and colored by the shell through `className`. */
export type PanelIcon = ComponentType<{ className?: string }>;

/** A panel a module adds to the editor. */
export interface LayoutPanel {
  /** Unique id, `<module>.<name>`. */
  id: string;
  /** Shown in error messages and as the label of its tab. */
  title: string;
  slot: LayoutSlot;
  /** Lower comes first within a slot. Defaults to 0. */
  order?: number;
  /** Icon of the panel's tab in the side rail. Side panels without one show only the title. */
  icon?: PanelIcon;
  component: ComponentType;
}

/** A piece a module adds to the top bar. */
export interface TopBarItem {
  /** Unique id, `<module>.<name>`. */
  id: string;
  /** `left` follows the brand, `center` sits after undo/redo, `right` at the end of the bar. */
  slot: "left" | "center" | "right";
  component: ComponentType;
}

/** A layer over the whole window, such as a collaborator's pointer. */
export interface AppOverlay {
  /** Unique id, `<module>.<name>`. */
  id: string;
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
