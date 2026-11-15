import type {
  BusId,
  CompositionId,
  CompressorEffect,
  GateEffect,
  SoundEffect,
  TrackId,
} from "@/modules/project";
import type { MixTarget } from "./sound.line.types";

/** A track or group that owns a chain, as `checkDuck` reads it. */
export interface DuckOwner {
  id: TrackId | BusId;
  name: string;
  compositionId: CompositionId;
}

/** The tracks that listen through ducks or send to groups, as `closesLoop` reads them. */
export type ListenNodes = Record<TrackId, { mix?: { busId?: BusId; effects?: SoundEffect[] } }>;

/** Where a chain command acts: a track, or the master or a group of `compositionId` (default: the open one). */
export interface ChainWhere {
  target: MixTarget;
  compositionId?: CompositionId;
}

/** How far a chain's noise reduction is rendered into its files. */
export interface DenoiseRendering {
  /** 0..1, the mean of the files rendering or waiting their turn; undefined while none is. */
  progress?: number;
  /** Why a file's rendering failed, while one has; changing a setting tries it again. */
  failed?: string;
}

/** An effect without its id, as a preset holds it: each use gets a fresh id. */
export type EffectSpec = SoundEffect extends infer E
  ? E extends SoundEffect
    ? Omit<E, "id">
    : never
  : never;

/** The spec of one kind of effect. */
export type EffectSpecOf<K extends SoundEffect["kind"]> = Extract<EffectSpec, { kind: K }>;

/** A named chain of effects. Applying it writes plain values: a project never depends on a preset. */
export interface SoundPreset {
  id: string;
  name: string;
  /** What it is for, one line. */
  description: string;
  effects: EffectSpec[];
}

/** The user's own presets, outside the project (`localStorage`, `cloudy-clip.sound-presets`). */
export interface UserPresets {
  presets: SoundPreset[];
}

/** The effects a transfer graph draws: level in against level out. */
export type TransferEffect = CompressorEffect | GateEffect;

/** What an effect's section tells the transfer graph while a value is dragged. */
export interface TransferGraphHandle {
  /** Draws the curve of these settings, without a React render. */
  draw(effect: TransferEffect): void;
}

/** Changes to the effects of one chain: drag steps reach the preview only, a release is one command. */
export interface EffectEdit {
  /** Plays the chain with this effect in place of the saved one, until the next commit. */
  live(effect: SoundEffect): void;
  /** Sends `sound.setEffect` with the fields that change, then stops playing the live chain. */
  commit(effectId: string, patch: Record<string, unknown>): Promise<void>;
  /** Sends `sound.removeEffect`. */
  remove(effectId: string): void;
}

/** A row of an effect chain dragged up or down. */
export interface ChainDrag {
  down: PointerEvent;
  /** The row being moved; it follows the pointer through `style`. */
  row: HTMLElement;
  /** The release, with the travel; null when the pointer never moved (a click). */
  onEnd(dy: number | null): void;
}
