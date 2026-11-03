import { useEffect, useRef, useState } from "react";
import { useKernel } from "@/core";
import {
  EFFECT_RANGES,
  useOpenComposition,
  type DenoiseEffect,
  type Track,
} from "@/modules/project";
import { Button, ProgressBar } from "@/ui";
import { defaultSpec } from "../../logic/effects";
import { measureFloor } from "../../sound.denoise.commands";
import type { EffectEdit } from "../../sound.types";
import { useDenoiseRendering } from "../denoise.hook";
import { EffectRow } from "./EffectRow";
import { EffectSection } from "./EffectSection";

const REST = defaultSpec("denoise");

interface DenoiseSectionProps {
  effect: DenoiseEffect;
  /** The track the chain is on; undefined for the master. */
  owner: Track | undefined;
  edit: EffectEdit;
}

/**
 * Noise reduction: how much goes and the floor it takes away, which Measure floor reads from a
 * second of the track at the playhead. It's rendered into each file, so it applies first, wherever
 * it sits in the chain (on Master: per file, for the tracks without their own). Its files render a
 * moment after a change and say how far along they are; the originals play until then.
 */
export function DenoiseSection({ effect, owner, edit }: DenoiseSectionProps) {
  const { bus } = useKernel();
  const open = useOpenComposition();
  const rendering = useDenoiseRendering(owner?.id ?? "master", open?.id, effect);
  const [measuring, setMeasuring] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const measure = async () => {
    if (!owner) return;
    setMeasuring(true);
    try {
      await bus.run(measureFloor, { trackId: owner.id });
    } finally {
      if (mounted.current) setMeasuring(false);
    }
  };

  return (
    <EffectSection effect={effect} edit={edit}>
      <EffectRow
        label="Amount"
        value={effect.amountDb}
        rest={REST.amountDb}
        {...EFFECT_RANGES.denoise.amountDb}
        step={0.5}
        unit="dB"
        disabled={!effect.on}
        edit={edit}
        write={(amountDb) => ({ effect: { ...effect, amountDb }, patch: { amountDb } })}
      />
      <EffectRow
        label="Floor"
        value={effect.floorDb}
        rest={REST.floorDb}
        {...EFFECT_RANGES.denoise.floorDb}
        step={1}
        unit="dB"
        disabled={!effect.on}
        edit={edit}
        write={(floorDb) => ({ effect: { ...effect, floorDb }, patch: { floorDb } })}
      />
      <p className="py-1 text-xs text-subtle-foreground">
        {owner
          ? "Applies before the rest of the chain, whatever its place."
          : "Applies to each file of the tracks without their own, before anything else."}
      </p>
      <div className="flex items-center gap-2 py-1">
        {owner && (
          <Button
            size="sm"
            disabled={!effect.on || measuring}
            title="Reads the floor from a second of this track at the playhead: put it where only the noise sounds."
            onClick={() => void measure()}
          >
            {measuring ? "Measuring…" : "Measure floor"}
          </Button>
        )}
        {rendering !== undefined && (
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
            <span className="truncate">
              Rendering… {Math.round(rendering * 100)}%. The original plays until it&apos;s done.
            </span>
            <ProgressBar value={rendering} />
          </div>
        )}
      </div>
    </EffectSection>
  );
}
