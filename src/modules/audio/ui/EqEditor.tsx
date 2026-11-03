import type { ClipSound } from "@/modules/project";
import { EqBandRow } from "./EqBandRow";
import { EqGraph } from "./EqGraph";

interface EqEditorProps {
  /** Six bands and whether they work: a clip's EQ, or an EQ effect in a chain. */
  eq: ClipSound["eq"];
  /** Nothing can be changed; the EQ also reads dimmed while it's off. */
  disabled?: boolean;
  /** Every move of a point on the graph: play it live, change nothing yet. */
  onInput(eq: ClipSound["eq"]): void;
  /** A release on the graph, or a change in a band's row: the one command. */
  onCommit(eq: ClipSound["eq"]): void;
}

/**
 * The equalizer's graph and a row per band, value in and callbacks out: the inspector's Equalizer
 * section and the Sound page's EQ effect draw the same editor.
 */
export function EqEditor({ eq, disabled = false, onInput, onCommit }: EqEditorProps) {
  const off = disabled || !eq.on;
  return (
    <>
      <EqGraph
        bands={eq.bands}
        disabled={off}
        onInput={(bands) => onInput({ ...eq, bands })}
        onCommit={(bands) => onCommit({ ...eq, bands })}
      />
      {eq.bands.map((band, index) => (
        <EqBandRow
          key={index}
          index={index}
          band={band}
          disabled={off}
          onChange={(next) => {
            const bands = eq.bands.map((one, i) => (i === index ? next : one));
            onCommit({ ...eq, bands });
          }}
        />
      ))}
    </>
  );
}
