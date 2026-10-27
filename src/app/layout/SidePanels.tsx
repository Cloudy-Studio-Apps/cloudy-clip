import { useState } from "react";
import type { LayoutPanel } from "@/core";
import { PanelSlot } from "./PanelSlot";
import { SideRail } from "./SideRail";

/** The side slot: a rail with one tab per panel, and the open panel next to it. */
export function SidePanels({ panels }: { panels: readonly LayoutPanel[] }) {
  const [openId, setOpenId] = useState<string>();
  const open = panels.find((panel) => panel.id === openId) ?? panels[0];

  return (
    <>
      <SideRail panels={panels} activeId={open?.id} onSelect={setOpenId} />
      <div className="min-w-0 flex-1 overflow-hidden">{open && <PanelSlot panels={[open]} />}</div>
    </>
  );
}
