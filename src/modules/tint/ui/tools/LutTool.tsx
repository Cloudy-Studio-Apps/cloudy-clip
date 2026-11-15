import { Upload } from "lucide-react";
import { useState } from "react";
import { useKernel } from "@/core";
import { INPUT_SPACES, type InputColorSpace } from "@/modules/project";
import { Button, cn, SelectField } from "@/ui";
import { setInput } from "../../tint.color.commands";
import { DEMO_LUTS } from "../demo/demo.values";
import { useEditTarget } from "../edit.target.hook";
import { settle } from "../settle";
import { SPACE_NAMES } from "../space.names";
import type { DemoField } from "../demo/demo.types";
import { DemoSliders } from "./DemoSliders";
import { ToolColumn } from "./ToolColumn";
import { ToolColumns } from "./ToolColumns";

const STRENGTH: readonly DemoField[] = [
  { label: "Strength", value: 80, min: 0, max: 100, step: 1 },
];

/** LUT and color: a LUT with its strength, and the camera's color space. */
export function LutTool() {
  const [lut, setLut] = useState<string>(DEMO_LUTS[0].name);
  const { bus } = useKernel();
  const { clipId, grade } = useEditTarget();
  const setSpace = (input: string) => {
    if (clipId)
      void settle(bus.run(setInput, { clipIds: [clipId], input: input as InputColorSpace }));
  };
  return (
    <ToolColumns>
      <ToolColumn title="LUT">
        <div className="flex flex-col gap-1">
          {DEMO_LUTS.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setLut(item.name)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-base",
                lut === item.name
                  ? "bg-muted text-foreground shadow-[inset_2px_0_0_var(--mark)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.name}
              <span className="ml-auto font-mono text-xs text-subtle-foreground">{item.kind}</span>
            </button>
          ))}
        </div>
        <Button size="sm" className="mt-3" title="Import a .cube file">
          <Upload className="size-3.5" /> Import .cube
        </Button>
      </ToolColumn>
      <ToolColumn title="Strength">
        <DemoSliders fields={STRENGTH} />
      </ToolColumn>
      <ToolColumn
        title="Color space"
        info="Set once per clip: the camera's footage is turned into Rec.709 before any correction. Footage is read at 8 bits for now, so log footage can show banding under heavy grades."
      >
        <SelectField
          label="Camera"
          value={grade?.input ?? "rec709"}
          onChange={setSpace}
          disabled={!clipId}
          options={INPUT_SPACES.map((s) => ({ value: s, label: SPACE_NAMES[s].name }))}
        />
        <p className="mt-3 text-sm text-muted-foreground">
          Grading in Rec.709 · Output Rec.709 gamma 2.4
        </p>
      </ToolColumn>
    </ToolColumns>
  );
}
