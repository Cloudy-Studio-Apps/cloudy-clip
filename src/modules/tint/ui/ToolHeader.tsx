import { Diamond, RotateCcw } from "lucide-react";
import { IconButton } from "@/ui";
import { HeaderGap } from "./HeaderGap";
import { PanelNote } from "./PanelNote";
import { useTintView } from "./view.hook";

const nothing = () => {};

/** Names the open tool and the layer it edits, with the keyframe diamond and reset. */
export function ToolHeader({ name }: { name: string }) {
  const leader = useTintView((v) => v.mode === "leader");
  return (
    <header className="flex h-[38px] shrink-0 items-center gap-1 border-b border-border pr-2 pl-[18px] font-hand text-md font-bold">
      {name}
      <HeaderGap />
      <PanelNote>{leader ? "Node" : "Layer"} 03 Skin</PanelNote>
      <IconButton label="Keyframe: animate this correction over time (K)" onClick={nothing}>
        <Diamond />
      </IconButton>
      <IconButton label="Reset this correction: back to neutral, the layer stays" onClick={nothing}>
        <RotateCcw />
      </IconButton>
    </header>
  );
}
