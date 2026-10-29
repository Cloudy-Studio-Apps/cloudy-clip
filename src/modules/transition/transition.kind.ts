import { Blend } from "lucide-react";
import { CommandFailure } from "@/core";
import { minimizeProps, prop, resolveProps } from "@/modules/element";
import { defineJunctionKind } from "@/modules/junction";
import type { TransitionApi } from "./transition.types";

/**
 * The `transition` junction kind: two clips of a video track overlap while a preset mixes their
 * pictures. `normalize` checks the preset and its options (a changed preset drops the old
 * options); `mix` and `display` look the preset up.
 */
export function createTransitionKind(api: TransitionApi) {
  return defineJunctionKind({
    kind: "transition",
    name: "Transition",
    icon: Blend,
    tracks: ["video"],
    properties: {
      preset: prop.string({ label: "Preset", control: "transition-preset" }),
      options: prop.custom("transition-options", {}, { label: "Options" }),
    },
    defaults: () => ({ preset: "", options: {} }),
    overlap: {
      default: 500_000,
      min: (state) => Math.ceil(1_000_000 / state.format.fps),
      max: (left, right) => Math.floor(Math.min(left.duration, right.duration) / 2),
    },
    normalize(next, env) {
      const id = String(next.preset ?? "");
      const preset = api.find(id);
      if (!preset) {
        const known = api.list().map((p) => p.id);
        throw new CommandFailure(
          "transition.unknown_preset",
          `No transition preset "${id}". Available: ${known.join(", ") || "none"}.`,
        );
      }
      const before = env.previous.preset;
      const changed = typeof before === "string" && before !== "" && before !== id;
      const parsed = api.optionsSchema(preset).safeParse(changed ? {} : (next.options ?? {}));
      if (!parsed.success) {
        const issue = parsed.error.issues[0]!;
        const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        throw new CommandFailure(
          "transition.invalid_options",
          `${preset.name}: ${where}${issue.message}`,
        );
      }
      const options = minimizeProps(
        parsed.data as Record<string, unknown>,
        preset.defaults(env.format),
      );
      return { ...next, preset: id, options };
    },
    mix(ctx, a, b, progress, props, env) {
      const preset = api.find(String(props.preset ?? ""));
      if (!preset) return;
      const options = resolveProps(
        (props.options ?? {}) as Record<string, unknown>,
        preset.defaults(env.format),
      );
      preset.mix(ctx, a, b, progress, options, env);
    },
    display: (props) => {
      const preset = api.find(String(props.preset ?? ""));
      return preset ? { label: preset.name } : {};
    },
  });
}
