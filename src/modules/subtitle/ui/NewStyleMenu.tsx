import { Plus } from "lucide-react";
import { useState } from "react";
import { report, useKernel } from "@/core";
import type { SubtitleStyle } from "@/modules/project";
import { Button, MenuList, Popover } from "@/ui";
import { PRESET_NAMES } from "../logic/presets";
import { addStyle } from "../subtitle.style.commands";
import type { SubtitlePresetId } from "../subtitle.types";

interface NewStyleMenuProps {
  compositionId: string;
  /** The style shown, offered as "Copy of …". */
  current: SubtitleStyle | undefined;
  /** The new style, to show it. */
  onMade(styleId: string): void;
}

/** New style: one of the four presets, or a copy of the style shown. */
export function NewStyleMenu({ compositionId, current, onMade }: NewStyleMenuProps) {
  const { bus } = useKernel();
  const [open, setOpen] = useState(false);
  const add = async (input: { preset?: SubtitlePresetId; fromStyleId?: string }) => {
    const made = report(await bus.run(addStyle, { compositionId, ...input }));
    if (made) onMade(made.styleId);
  };
  const presets = Object.entries(PRESET_NAMES) as [SubtitlePresetId, string][];

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button size="sm">
          <Plus />
          New style
        </Button>
      }
    >
      <MenuList
        onClose={() => setOpen(false)}
        items={[
          ...presets.map(([preset, label]) => ({
            label,
            group: "presets",
            onSelect: () => void add({ preset }),
          })),
          ...(current
            ? [
                {
                  label: `Copy of ${current.name}`,
                  group: "copy",
                  onSelect: () => void add({ fromStyleId: current.id }),
                },
              ]
            : []),
        ]}
      />
    </Popover>
  );
}
