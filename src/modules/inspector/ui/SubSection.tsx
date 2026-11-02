import type { ReactNode } from "react";
import { getPath, type ResolvedItem } from "@/modules/element";
import { ToggleRow } from "@/ui";
import type { PropsLive } from "../inspector.types";
import { pathPatch } from "../logic/paths";

interface SubSectionProps {
  item: Extract<ResolvedItem, { type: "sub" }>;
  values: Record<string, unknown>;
  live: PropsLive;
  /** Whether the field at a path can be changed now. */
  enabled(path: string): boolean;
  children: ReactNode;
}

/** A titled group inside a section; with a toggle, its fields show only while it is on. */
export function SubSection({ item, values, live, enabled, children }: SubSectionProps) {
  const header = item.header;
  if (header !== undefined) {
    return (
      <ToggleRow
        label={item.title}
        checked={getPath(values, header) === true}
        disabled={!enabled(header)}
        onChange={(checked) => live.commit(pathPatch(header, checked))}
      >
        {children}
      </ToggleRow>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="font-hand text-[13px] font-bold text-foreground">{item.title}</span>
      <div className="flex flex-col gap-2 pl-2">{children}</div>
    </div>
  );
}
