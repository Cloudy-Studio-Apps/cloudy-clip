import { ChevronDown, GitBranch } from "lucide-react";
import { useState } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { MenuList, Popover, type MenuItem } from "@/ui";
import { projectRef } from "@/modules/project";
import { activeVersion, versionNames } from "../logic/versions";
import { setVersion } from "../tint.shot.commands";
import type { VersionAction } from "../tint.types";
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
  const [renaming, setRenaming] = useState(false);
  const level = useTintView((v) => v.level);
  const clipId = useCurrentClip();
  const clip = useStore(useModule(projectRef).store.api, (s) =>
    clipId ? s.clips[clipId] : undefined,
  );
  if (level !== "clip" || !clip) return null;
  const active = activeVersion(clip);
  const names = versionNames(clip);
  const run = (input: { action: VersionAction; name: string; to?: string }) =>
    void settle(bus.run(setVersion, { clipIds: [clip.id], ...input }));
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
        setOpen(false);
        setRenaming(true);
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
  const rename = (value: string) => {
    setRenaming(false);
    const to = value.trim();
    if (to && to !== active) run({ action: "rename", name: active, to });
  };
  if (renaming) {
    return (
      <input
        autoFocus
        defaultValue={active}
        aria-label="Version name"
        onBlur={(event) => rename(event.currentTarget.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") rename(event.currentTarget.value);
          if (event.key === "Escape") setRenaming(false);
        }}
        className="ml-1.5 h-6 w-20 rounded-xs bg-surface px-1 font-mono text-xs outline-none"
      />
    );
  }
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
