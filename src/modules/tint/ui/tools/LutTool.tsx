import { Upload } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { INPUT_SPACES, projectRef, type InputColorSpace } from "@/modules/project";
import { Button, cn, SelectField, SliderField } from "@/ui";
import { setInput } from "../../tint.color.commands";
import { tintRef } from "../../tint.ref";
import { useCurrentEntry } from "../current.hook";
import { useEditTarget } from "../edit.target.hook";
import { useLiveEdit } from "../live.edit.hook";
import { usePickLut } from "../lut.pick.hook";
import { settle } from "../settle";
import { SPACE_NAMES } from "../space.names";
import { ToolColumn } from "./ToolColumn";
import { ToolColumns } from "./ToolColumns";

/** LUT and color: the project's LUTs, Import .cube and strength, and the camera's color space. */
export function LutTool() {
  const { bus } = useKernel();
  const { store } = useModule(projectRef);
  const { luts: files } = useModule(tintRef);
  const { clipId, grade, nodeId } = useEditTarget();
  const edit = useLiveEdit(clipId, nodeId);
  const { pick, locate } = usePickLut();
  const all = useStore(store.api, (s) => s.luts);
  const status = useStore(files.store);
  const luts = useMemo(
    () => Object.values(all ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [all],
  );
  const node = nodeId ? grade?.nodes[nodeId] : undefined;
  const current = node?.kind === "correct" ? node.lut : undefined;
  const strength = current?.strength ?? 1;
  const choose = (id: string | null) => void edit.commit({ lut: id ? { id, strength } : null });
  // A composition's picture is Rec.709 already (`tint.setInput` refuses a camera space there).
  const nested = useCurrentEntry()?.clip.compositionRef !== undefined;
  const setSpace = (input: string) => {
    if (clipId)
      void settle(bus.run(setInput, { clipIds: [clipId], input: input as InputColorSpace }));
  };
  const row = (selected: boolean) =>
    cn(
      "flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-base disabled:cursor-default disabled:opacity-50",
      selected
        ? "bg-muted text-foreground shadow-[inset_2px_0_0_var(--mark)]"
        : "text-muted-foreground hover:text-foreground",
    );
  return (
    <ToolColumns>
      <ToolColumn title="LUT">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={!edit.enabled || !current}
            onClick={() => choose(null)}
            className={row(!current)}
          >
            None
          </button>
          {luts.map((lut) => {
            const missing = status[lut.path]?.status === "missing";
            return (
              <button
                key={lut.id}
                type="button"
                disabled={!edit.enabled}
                title={lut.path}
                onClick={() => (missing ? void locate(lut) : choose(lut.id))}
                className={row(current?.id === lut.id)}
              >
                <span className="min-w-0 truncate">{lut.name}</span>
                <span
                  className={cn(
                    "ml-auto font-mono text-xs",
                    missing ? "text-destructive" : "text-subtle-foreground",
                  )}
                >
                  {missing ? "Missing · Locate" : "Imported"}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          size="sm"
          className="mt-3"
          title="Import a .cube file"
          onClick={() =>
            void pick().then((id) => {
              if (id && edit.enabled) void edit.commit({ lut: { id, strength } });
            })
          }
        >
          <Upload className="size-3.5" /> Import .cube
        </Button>
      </ToolColumn>
      <ToolColumn title="Strength">
        <SliderField
          label="Strength"
          value={Math.round(strength * 100)}
          min={0}
          max={100}
          step={1}
          resetTo={100}
          disabled={!current}
          onInput={(next) => current && edit.preview({ lut: { ...current, strength: next / 100 } })}
          onCommit={(next) => {
            if (!current || next / 100 === current.strength) edit.cancel();
            else void edit.commit({ lut: { ...current, strength: next / 100 } });
          }}
        />
      </ToolColumn>
      <ToolColumn
        title="Color space"
        info="Set once per clip: the camera's footage is turned into Rec.709 before any correction. Footage is read at 8 bits for now, so log footage can show banding under heavy grades."
      >
        <SelectField
          label="Camera"
          value={grade?.input ?? "rec709"}
          onChange={setSpace}
          disabled={!clipId || nested}
          options={INPUT_SPACES.map((s) => ({ value: s, label: SPACE_NAMES[s].name }))}
        />
        <p className="mt-3 text-sm text-muted-foreground">
          Grading in Rec.709 · Output Rec.709 gamma 2.4
        </p>
      </ToolColumn>
    </ToolColumns>
  );
}
