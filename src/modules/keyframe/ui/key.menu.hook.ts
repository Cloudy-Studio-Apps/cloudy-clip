import { Check, Copy, FlipHorizontal2, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { EASE_PRESETS } from "@/modules/project";
import type { MenuItem } from "@/ui";
import { setAfter } from "../keyframe.ease.commands";
import { clearKeys } from "../keyframe.commands";
import type { KeyMenus } from "../keyframe.types";
import { report, useKeyActions } from "./panel.actions.hook";

const AFTER = [
  { id: "hold", label: "Hold" },
  { id: "loop", label: "Loop" },
  { id: "pingpong", label: "Ping-pong" },
] as const;

/** The context menus of the panel's keys and rows. Each entry runs a command through the bus. */
export function useKeyMenus(): KeyMenus {
  const { bus } = useKernel();
  const { playback } = useModule(previewRef);
  const actions = useKeyActions();

  return useMemo(
    () => ({
      selection: () => [
        { label: "Reverse keys", icon: FlipHorizontal2, onSelect: actions.reverse },
        { label: "Copy", icon: Copy, shortcut: "Ctrl+C", onSelect: actions.copy },
        {
          label: "Delete",
          icon: Trash2,
          shortcut: "Del",
          destructive: true,
          onSelect: actions.remove,
        },
        {
          label: "Curve after this key",
          group: "curve",
          items: EASE_PRESETS.map((preset) => ({
            label: preset.label,
            onSelect: () => actions.ease(preset.id),
          })),
        },
      ],
      row: (clip, field) => {
        const current = clip.animation?.[field.path]?.after ?? "hold";
        const items: MenuItem[] = [];
        // A field that can't loop (speed) has nothing to choose after its last key.
        if (field.loops !== false) {
          items.push({
            label: "After the last key",
            items: AFTER.map(({ id, label }) => ({
              label,
              icon: id === current ? Check : undefined,
              onSelect: () =>
                void bus
                  .run(setAfter, { clipId: clip.id, path: field.path, after: id })
                  .then(report),
            })),
          });
        }
        items.push({
          label: "Remove animation",
          icon: Trash2,
          destructive: true,
          group: "remove",
          onSelect: () =>
            void bus
              .run(clearKeys, { clipId: clip.id, paths: [field.path], at: playback.getTime() })
              .then(report),
        });
        return items;
      },
    }),
    [bus, playback, actions],
  );
}
