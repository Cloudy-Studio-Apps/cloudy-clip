import { useModule } from "@/core";
import { InspectorSection, FieldRow, type InspectorContext } from "@/modules/inspector";
import { projectRef } from "@/modules/project";
import { useStore } from "zustand";
import { SegmentedControl, SelectField, ToggleRow, type SegmentedOption } from "@/ui";
import { useMaskEdit } from "./mask.edit.hook";

const USES: SegmentedOption<"alpha" | "luma">[] = [
  { value: "alpha", label: "Alpha" },
  { value: "luma", label: "Brightness" },
];

/** The Mask tab's track matte: which video track's picture decides where the clip shows. */
export function MatteSection({ context }: { context: InspectorContext }) {
  const { clip, track } = context;
  const edit = useMaskEdit(clip.id);
  const project = useModule(projectRef).store;
  const tracks = useStore(project.api, (s) => s.tracks);
  const order = useStore(project.api, (s) => s.compositions[track.compositionId]?.trackOrder);
  const options = [
    { value: "", label: "None" },
    ...(order ?? []).flatMap((id) => {
      const t = tracks[id];
      return t && t.kind === "video" && t.id !== track.id ? [{ value: t.id, label: t.name }] : [];
    }),
  ];
  const matte = clip.matte;

  // Always both `by` and `invert`: a command with only one resets the other.
  const set = (trackId: string | null, by: "alpha" | "luma", invert: boolean) =>
    void edit.run("mask.setMatte", { clipIds: edit.targets(), trackId, by, invert });

  return (
    <InspectorSection title="Track matte">
      <FieldRow label="Matte">
        <SelectField
          label="Matte track"
          value={matte?.trackId ?? ""}
          options={options}
          className="flex-1"
          onChange={(id) =>
            set(id === "" ? null : id, matte?.by ?? "alpha", matte?.invert === true)
          }
        />
      </FieldRow>
      <FieldRow label="Use">
        <SegmentedControl
          label="Matte use"
          options={USES}
          value={matte?.by}
          disabled={!matte}
          onChange={(by) => matte && set(matte.trackId, by, matte.invert === true)}
        />
      </FieldRow>
      <ToggleRow
        label="Invert"
        checked={matte?.invert === true}
        disabled={!matte}
        onChange={(invert) => matte && set(matte.trackId, matte.by, invert)}
      />
    </InspectorSection>
  );
}
