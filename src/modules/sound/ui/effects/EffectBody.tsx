import type { SoundEffect, Track } from "@/modules/project";
import type { EffectEdit } from "../../sound.types";
import { CompressorSection } from "./CompressorSection";
import { DeesserSection } from "./DeesserSection";
import { DuckSection } from "./DuckSection";
import { EqEffectSection } from "./EqEffectSection";
import { GateSection } from "./GateSection";
import { LimiterSection } from "./LimiterSection";

interface EffectBodyProps {
  effect: SoundEffect;
  /** The track the chain is on; undefined for the master. */
  owner: Track | undefined;
  edit: EffectEdit;
}

/** The section of an effect, by its kind. Noise reduction has none until its files are rendered. */
export function EffectBody({ effect, owner, edit }: EffectBodyProps) {
  switch (effect.kind) {
    case "eq":
      return <EqEffectSection effect={effect} edit={edit} />;
    case "compressor":
      return <CompressorSection effect={effect} edit={edit} />;
    case "gate":
      return <GateSection effect={effect} edit={edit} />;
    case "deesser":
      return <DeesserSection effect={effect} edit={edit} />;
    case "limiter":
      return <LimiterSection effect={effect} edit={edit} />;
    case "duck":
      return owner ? <DuckSection effect={effect} owner={owner} edit={edit} /> : null;
    case "denoise":
      return null;
  }
}
