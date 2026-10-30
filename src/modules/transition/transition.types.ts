import type { z } from "zod";
import type { Cut, MixFn } from "@/modules/junction";
import type { PropertyTree, PropSpec } from "@/modules/element";
import type { ProjectFormat } from "@/modules/project";

/** A look of transition (dissolve, wipe, glitch…): declared once with `defineTransitionPreset`. */
export interface TransitionPresetDefinition {
  id: string;
  name: string;
  category: "basic" | "overlay" | "blur" | "glitch" | (string & {});
  /** The preset's options. */
  properties: PropertyTree;
  defaults(format: ProjectFormat): Record<string, unknown>;
  mix: MixFn;
  /** Optional faster thumbnail draw; defaults to `mix` over two sample pictures. */
  thumbnail?: MixFn;
}

/** What a transition junction stores in its `props`. */
export interface TransitionProps {
  /** Id of a registered preset. */
  preset: string;
  /** The preset's option values that differ from its defaults. */
  options: Record<string, unknown>;
}

/** The transition module's API: the presets contributed to `transitionPresets`. */
export interface TransitionApi {
  /** The preset with this id. */
  find(id: string): TransitionPresetDefinition | undefined;
  /** Every preset, in contribution order. */
  list(): readonly TransitionPresetDefinition[];
  /** The schema of a patch of the preset's options. */
  optionsSchema(preset: TransitionPresetDefinition): z.ZodObject;
}

declare module "@/modules/element" {
  interface CustomProps {
    /** `prop.custom("transition-options", {})`: the options of the chosen preset. */
    "transition-options": Record<string, never>;
  }
  interface CustomValues {
    "transition-options": Record<string, unknown>;
  }
}

/** One of a preset's options as the inspector shows it. */
export interface OptionField {
  name: string;
  spec: PropSpec;
  label: string;
  /** Control id from the inspector's `propertyControls`. */
  control: string;
}

/** What a press on a preset tile reports. */
export interface PresetGestureHandlers {
  onClick(): void;
  /** The cut under the pointer while dragging that can take a transition, or null. */
  cutAt(clientX: number, clientY: number): Cut | null;
  /** Called when the hovered cut changes (null when there is none). */
  onHover(cut: Cut | null): void;
  /** Released over a cut. */
  onDrop(cut: Cut): void;
}

/** The two sample pictures a thumbnail mixes, as CSS colors. */
export interface SampleColors {
  a: string;
  b: string;
}

/** Scratch objects kept per destination canvas (R9), so nothing is allocated per frame. */
export interface Scratch {
  ghost?: HTMLCanvasElement;
  /** One canvas per blur level (Woosh). */
  blur?: HTMLCanvasElement[];
  dissolve?: {
    key: string;
    values: Float32Array;
    canvas: HTMLCanvasElement;
    image: ImageData;
  };
}
