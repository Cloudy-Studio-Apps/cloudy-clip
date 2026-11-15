import { ChevronDown, GitBranch } from "lucide-react";
import { useState } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { MenuList, Popover, type MenuItem } from "@/ui";
import { projectRef } from "@/modules/project";
import { activeVersion, versionNames } from "../logic/versions";
import { setVersion } from "../tint.shot.commands";
import { useCurrentClip } from "./current.hook";
import { settle } from "./settle";
import { useTintView } from "./view.hook";

/**
 * Versions of the current clip's grade: flip between them, add, rename, delete. They are per
 * clip, so the menu is not there at the shot group and timeline levels.
 */
export function VersionMenu() {
  const { bus } = useKernel();
  const [open, setOpen] = useState(false);
  const level = useTintView((v) => v.level);
  const clipId = useCurrentClip();
  const clip = useStore(useModule(projectRef).store.api, (s) =>
    clipId ? s.clips[clipId] : undefined,
  );
  if (level !== "clip" || !clip) return null;
  const active = activeVersion(clip);
  const names = versionNames(clip);
  const run = (input: {
    action: "create" | "switch" | "rename" | "delete";
    name: string;
    to?: string;
  }) => void settle(bus.run(setVersion, { clipIds: [clip.id], ...input }));
  const free = (from: number) => {
    let n = from;
    while (names.includes(String.fromCharCode(64 + n))) n++;
    return String.fromCharCode(64 + n);
  };
  const items: MenuItem[] = [
    ...names.map((name) => ({
      label: name === active ? `${name} (showing)` : name,
      onSelect: () => run({ action: "switch", name }),
      group: "versions",
    })),
    {
      label: "New version",
      onSelect: () =>
        run({ action: "create", name: names.length < 26 ? free(1) : `V${names.length + 1}` }),
      group: "edit",
    },
    {
      label: "Rename…",
      onSelect: () => {
        const to = window.prompt(`Rename version "${active}" to`, active)?.trim();
        if (to) run({ action: "rename", name: active, to });
      },
      group: "edit",
    },
    ...names
      .filter((name) => name !== active)
      .map((name) => ({
        label: `Delete ${name}`,
        onSelect: () => run({ action: "delete", name }),
        group: "delete",
        destructive: true,
      })),
  ];
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          title="Versions: keep several grades on a clip and flip between them"
          className="ml-1.5 inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm bg-background px-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <GitBranch className="size-3.5" />
          {active}
          <ChevronDown className="size-3" />
        </button>
      }
    >
      <MenuList items={items} onClose={() => setOpen(false)} />
    </Popover>
  );
}
