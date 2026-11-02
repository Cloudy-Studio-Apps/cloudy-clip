import { InspectorSection, type InspectorContext } from "@/modules/inspector";
import { Switch } from "@/ui";
import { EqBandRow } from "./EqBandRow";
import { EqGraph } from "./EqGraph";
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
      <EqGraph
        bands={eq.bands}
        disabled={!eq.on}
        onInput={(bands) => live({ eq: { ...eq, bands } })}
        onCommit={(bands) => void commit({ eq: { ...eq, bands } })}
      />
      {eq.bands.map((band, index) => (
        <EqBandRow
          key={index}
          index={index}
          band={band}
          disabled={!eq.on}
          onChange={(next) => {
            const bands = eq.bands.map((one, i) => (i === index ? next : one));
            void commit({ eq: { ...eq, bands } });
          }}
        />
      ))}
    </InspectorSection>
  );
}
