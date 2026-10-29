import type { ReactNode } from "react";
import { getPath, type ResolvedItem } from "@/modules/element";
import { ToggleRow } from "@/ui";
import type { PropsLive } from "../inspector.types";
import { pathPatch } from "../logic/paths";

interface SubSectionProps {
  item: Extract<ResolvedItem, { type: "sub" }>;
  values: Record<string, unknown>;
  live: PropsLive;
  children: ReactNode;
}

/** A titled group inside a section; with a toggle, its fields show only while it is on. */
export function SubSection({ item, values, live, children }: SubSectionProps) {
  const header = item.header;
  if (header !== undefined) {
    return (
      <ToggleRow
        label={item.title}
        checked={getPath(values, header) === true}
        onChange={(checked) => live.commit(pathPatch(header, checked))}
      >
        {children}
      </ToggleRow>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-2xs font-semibold uppercase tracking-[0.04em] text-subtle-foreground">
        {item.title}
      </span>
      <div className="flex flex-col gap-2 pl-2">{children}</div>
    </div>
  );
}
