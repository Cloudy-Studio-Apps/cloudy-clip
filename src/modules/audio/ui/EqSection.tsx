import { InspectorSection, type InspectorContext } from "@/modules/inspector";
import { Switch } from "@/ui";
import { EqEditor } from "./EqEditor";
import { useSoundEdit } from "./sound.edit.hook";

/** Six bands on a graph, with a row for each. */
export function EqSection({ context }: { context: InspectorContext }) {
  const { sound, live, commit } = useSoundEdit(context);
  if (!sound) return null;
  const { eq } = sound;
  return (
    <InspectorSection
      title="Equalizer"
      foldKey="audio.eq"
      leading={
        <Switch
          label="Equalizer"
          checked={eq.on}
          onChange={(on) => void commit({ eq: { ...eq, on } })}
        />
      }
    >
      <EqEditor
        eq={eq}
        onInput={(next) => live({ eq: next })}
        onCommit={(next) => void commit({ eq: next })}
      />
    </InspectorSection>
  );
}
