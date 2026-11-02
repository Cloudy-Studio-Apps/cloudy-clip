import { ClipboardPaste, Copy, CopyPlus, Scissors } from "lucide-react";
import type { StoreApi } from "zustand/vanilla";
import {
  EDITOR_PAGE,
  LOCAL_ACTOR,
  pagesRef,
  type AppMenuItem,
  type Keybinding,
  type ModuleContext,
} from "@/core";
import type { ClipActions, TimelineApi, TimelineMenuItems } from "./timeline.types";
import type { TimelineViewState } from "./timeline.types";
import { copyClips, cutClips, duplicateClips, pasteClips } from "./timeline.clipboard.commands";

/** Clipboard entries of a clip's menu. Paste lands at the playhead: the clicked spot is taken. */
export function clipboardMenu(ctx: ModuleContext, timeline: TimelineApi): ClipActions {
  const copied = () => timeline.clipboard.get(LOCAL_ACTOR) !== undefined;
  const clipIds = () => timeline.view.getState().selection;
  return {
    id: "timeline.clipboard",
    items: () => [
      {
        group: "clipboard",
        icon: Scissors,
        label: "Cut",
        shortcut: "Ctrl+X",
        onSelect: () => void ctx.bus.run(cutClips, { clipIds: clipIds() }),
      },
      {
        group: "clipboard",
        order: 10,
        icon: Copy,
        label: "Copy",
        shortcut: "Ctrl+C",
        onSelect: () => void ctx.bus.run(copyClips, { clipIds: clipIds() }),
      },
      ...(copied()
        ? [
            {
              group: "clipboard" as const,
              order: 20,
              icon: ClipboardPaste,
              label: "Paste",
              shortcut: "Ctrl+V",
              onSelect: () => void ctx.bus.run(pasteClips, {}),
            },
          ]
        : []),
      {
        group: "clipboard",
        order: 30,
        icon: CopyPlus,
        label: "Duplicate",
        shortcut: "Ctrl+D",
        onSelect: () => void ctx.bus.run(duplicateClips, { clipIds: clipIds() }),
      },
    ],
  };
}

/** Paste on the empty timeline: lands where the right click was. */
export function pasteMenu(ctx: ModuleContext, timeline: TimelineApi): TimelineMenuItems {
  return {
    id: "timeline.paste",
    items(at) {
      if (!at || !timeline.clipboard.get(LOCAL_ACTOR)) return [];
      return [
        {
          label: "Paste",
          shortcut: "Ctrl+V",
          onSelect: () =>
            void ctx.bus.run(pasteClips, { time: Math.round(at.time), trackId: at.trackId }),
        },
      ];
    },
  };
}

/** The clipboard's shortcuts. They run on every page, so off the editor they do nothing. */
export function clipboardKeys(ctx: ModuleContext, view: StoreApi<TimelineViewState>): Keybinding[] {
  const onEditor = () => ctx.require(pagesRef).store.getState().active === EDITOR_PAGE;
  const onSelection = (command: string) => () => {
    const { selection: clipIds } = view.getState();
    return onEditor() && clipIds.length > 0 ? { command, input: { clipIds } } : null;
  };
  return [
    { id: "timeline.cut", key: "x", mod: true, resolve: onSelection(cutClips.id) },
    { id: "timeline.copy", key: "c", mod: true, resolve: onSelection(copyClips.id) },
    {
      id: "timeline.paste",
      key: "v",
      mod: true,
      resolve: () => (onEditor() ? { command: pasteClips.id, input: {} } : null),
    },
    { id: "timeline.duplicate", key: "d", mod: true, resolve: onSelection(duplicateClips.id) },
  ];
}

/** The same four in the app menu's Edit submenu. */
export function clipboardMenuItems(): AppMenuItem[] {
  const entry = (id: string, label: string, order: number) => ({
    id,
    menu: "Edit",
    label,
    order,
    keybinding: id,
  });
  return [
    entry("timeline.cut", "Cut", 21),
    entry("timeline.copy", "Copy", 22),
    entry("timeline.paste", "Paste", 23),
    entry("timeline.duplicate", "Duplicate", 24),
  ];
}
