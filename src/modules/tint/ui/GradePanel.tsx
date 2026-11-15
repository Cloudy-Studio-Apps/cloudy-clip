import { ClipboardPaste, Copy, Images, ListTree, RotateCcw, Workflow } from "lucide-react";
import { useKernel } from "@/core";
import { IconButton, SegmentedControl } from "@/ui";
import { resetGrade } from "../tint.commands";
import type { GradeTab } from "../tint.types";
import { CurrentNote } from "./CurrentNote";
import { useCurrentClip } from "./current.hook";
import { settle } from "./settle";
import { HeaderGap } from "./HeaderGap";
import { LayerList } from "./LayerList";
import { LooksTab } from "./looks/LooksTab";
import { NodeGraph } from "./NodeGraph";
import { TintPanel } from "./TintPanel";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

const nothing = () => {};

/** The grade of the current clip: layers or nodes (by the seal switch), and the Looks tab. */
export function GradePanel() {
  const mode = useTintView((v) => v.mode);
  const tab = useTintView((v) => v.leftTab);
  const set = useTintSet();
  const { bus } = useKernel();
  const clipId = useCurrentClip();
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
          <CurrentNote />
          <HeaderGap />
          <IconButton label="Copy grade (Ctrl+C)" onClick={nothing}>
            <Copy />
          </IconButton>
          <IconButton label="Paste grade (Ctrl+V)" onClick={nothing}>
            <ClipboardPaste />
          </IconButton>
          <IconButton
            label="Reset grade: remove every correction from this clip"
            onClick={() => clipId && void settle(bus.run(resetGrade, { target: { clipId } }))}
          >
            <RotateCcw />
          </IconButton>
        </>
      }
    >
      {tab === "looks" ? <LooksTab /> : leader ? <NodeGraph /> : <LayerList />}
    </TintPanel>
  );
}
