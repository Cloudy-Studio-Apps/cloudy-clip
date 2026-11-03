import type { ComponentType } from "react";
import type { StoreApi } from "zustand/vanilla";

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

/**
 * What a page's timeline may edit: `"all"` on the editor, `"sound"` on a page that works on sound
 * only (audio tracks, and edits that leave pictures alone).
 */
export type TimelineScopeName = "all" | "sound";

/** A page of the app, with a tab of its own in the top bar. */
export interface AppPage {
  /** Unique id, `<module>.<name>`. */
  id: string;
  /** Label of its tab. */
  label: string;
  /** Icon of its tab. */
  icon: PanelIcon;
  /** Id of the `AppPageGroup` its tab sits in. Defaults to `PAGE_GROUP_CREATE`. */
  group?: string;
  /** Lower comes first within the group. Defaults to 0. */
  order?: number;
  /** Takes the place of the editor below the top bar. Only the editor's own page has none. */
  component?: ComponentType;
  /**
   * Keeps what plays while the page covers the editor, and lets plain keys (Space, S, Delete) work
   * on it. Without it, playback pauses when the page opens and plain keys wait for the editor.
   */
  keepsPlayback?: boolean;
  /** The scope of the timeline on this page. Unset means `"all"`. */
  timelineScope?: TimelineScopeName;
}

/** Tabs that belong together. A divider separates groups in the top bar. */
export interface AppPageGroup {
  /** Unique id. A page naming a group nobody declared still shows, after the declared ones. */
  id: string;
  /** Lower comes first. Defaults to 0. */
  order?: number;
}

/** Which page shows. */
export interface PagesState {
  /** Id of an `AppPage`, or `EDITOR_PAGE`. */
  active: string;
}

/** The pages of one kernel. */
export interface PagesApi {
  /** Read with `useStore(pages.store, selector)`. Changed by the `pages.show` command. */
  readonly store: StoreApi<PagesState>;
}

/** An entry of the app's menu, behind the logo. */
export interface AppMenuItem {
  /** Unique id, `<module>.<name>`. */
  id: string;
  /** The submenu it sits in, such as `File`. Unset: an entry of the menu itself, after the submenus. */
  menu?: string;
  label: string;
  /** Lower comes first within the submenu, or among the menu's own entries. Defaults to 0. */
  order?: number;
  /** Id of a keybinding: shows its shortcut, and is what runs without `run`. */
  keybinding?: string;
  run?(): void;
  /** Asked when the menu opens. Defaults to on. */
  enabled?(): boolean;
  /** Makes it open a submenu of these, asked when the menu opens. */
  items?(): readonly { label: string; onSelect(): void }[];
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
