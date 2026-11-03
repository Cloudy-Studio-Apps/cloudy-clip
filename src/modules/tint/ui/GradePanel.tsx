import { ClipboardPaste, Copy, Images, ListTree, RotateCcw, Workflow } from "lucide-react";
import { IconButton, SegmentedControl } from "@/ui";
import type { GradeTab } from "../tint.types";
import { HeaderGap } from "./HeaderGap";
import { LayerList } from "./LayerList";
import { LooksTab } from "./looks/LooksTab";
import { NodeGraph } from "./NodeGraph";
import { PanelNote } from "./PanelNote";
import { TintPanel } from "./TintPanel";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

const nothing = () => {};

/** The grade of the current clip: layers or nodes (by the seal switch), and the Looks tab. */
export function GradePanel() {
  const mode = useTintView((v) => v.mode);
  const tab = useTintView((v) => v.leftTab);
  const set = useTintSet();
  const leader = mode === "leader";
  return (
    <TintPanel
      header={
        <>
          <SegmentedControl<GradeTab>
            label="Grade panel"
            value={tab}
            onChange={(leftTab) => set({ leftTab })}
            options={[
              {
                value: "grade",
                label: leader ? "Nodes" : "Layers",
                icon: leader ? Workflow : ListTree,
              },
              {
                value: "looks",
                label: "Looks",
                icon: Images,
                hint: "Stills you grabbed and saved looks",
              },
            ]}
          />
          <PanelNote>02 Plaza wide</PanelNote>
          <HeaderGap />
          <IconButton label="Copy grade (Ctrl+C)" onClick={nothing}>
            <Copy />
          </IconButton>
          <IconButton label="Paste grade (Ctrl+V)" onClick={nothing}>
            <ClipboardPaste />
          </IconButton>
          <IconButton label="Reset grade: remove every correction from this clip" onClick={nothing}>
            <RotateCcw />
          </IconButton>
        </>
      }
    >
      {tab === "looks" ? <LooksTab /> : leader ? <NodeGraph /> : <LayerList />}
    </TintPanel>
  );
}
