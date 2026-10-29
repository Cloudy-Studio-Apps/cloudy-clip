import { useMemo, useRef } from "react";
import { useStore } from "zustand";
import { useModule, usePoint } from "@/core";
import { propTypes } from "@/modules/element";
import { propertyControls, type FieldControlProps, type PropsLive } from "@/modules/inspector";
import { projectRef } from "@/modules/project";
import { optionFields, optionsPatch } from "../logic/options";
import { transitionRef } from "../transition.ref";

/**
 * The `transition-options` control: the chosen preset's own options, each drawn by the inspector
 * control its spec names. A change is sent as the whole `options` object (stored options plus the
 * change), through the `live` the inspector gave.
 */
export function TransitionOptionsControl({
  clip,
  value,
  values,
  disabled,
  live,
}: FieldControlProps) {
  const transitions = useModule(transitionRef);
  const controls = usePoint(propertyControls);
  const types = usePoint(propTypes);
  const format = useStore(useModule(projectRef).store.api, (s) => s.format);
  const preset = transitions.find(String(values.preset ?? ""));
  const stored = useMemo(
    () => (value && typeof value === "object" ? (value as Record<string, unknown>) : {}),
    [value],
  );
  const fields = useMemo(
    () =>
      preset ? optionFields(preset.properties, (name) => types.find((t) => t.name === name)) : [],
    [preset, types],
  );
  const resolved = useMemo(
    () => ({ ...preset?.defaults(format), ...stored }),
    [preset, format, stored],
  );
  // Option changes input while dragging, so the commit still carries them.
  const pending = useRef<Record<string, unknown>>({});
  const optionsLive = useMemo<PropsLive>(
    () => ({
      input(patch) {
        pending.current = { ...pending.current, ...patch };
        live.input(optionsPatch(stored, pending.current));
      },
      commit(patch) {
        const input = pending.current;
        pending.current = {};
        live.commit(optionsPatch(stored, input, patch));
      },
    }),
    [live, stored],
  );
  if (!preset || fields.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      {fields.map(({ name, spec, label, control }) => {
        const entry = controls.find((c) => c.id === control && c.for === "field");
        if (!entry || entry.for !== "field") return null;
        const Control = entry.component;
        return (
          <Control
            key={name}
            clip={clip}
            path={name}
            spec={spec}
            value={resolved[name]}
            values={resolved}
            label={label}
            disabled={disabled || spec.readOnly === true}
            live={optionsLive}
          />
        );
      })}
    </div>
  );
}
