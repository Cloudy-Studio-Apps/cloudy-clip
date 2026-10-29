import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "zustand";
import { microsToSeconds, useKernel, useModule } from "@/core";
import { durationLimits, junctionRef, removeJunction, setJunction } from "@/modules/junction";
import { projectRef, type JunctionId } from "@/modules/project";
import { Button, NumberField } from "@/ui";
import { junctionLayoutSource, junctionSetInput } from "../logic/junction";
import { FieldRow } from "./controls/FieldRow";
import { useJunctionLive } from "./junction.live.hook";
import { InspectorHeader } from "./InspectorHeader";
import { InspectorSection } from "./InspectorSection";
import { PropertyPanel } from "./PropertyPanel";

/** Details of one selected junction: its duration, its kind's values and a way to remove it. */
export function JunctionView({ junctionId }: { junctionId: JunctionId }) {
  const { bus } = useKernel();
  const project = useModule(projectRef).store;
  const junctions = useModule(junctionRef);
  const junction = useStore(project.api, (s) => s.junctions[junctionId]);
  const left = useStore(project.api, (s) => (junction ? s.clips[junction.leftClipId] : undefined));
  const right = useStore(project.api, (s) =>
    junction ? s.clips[junction.rightClipId] : undefined,
  );
  const format = useStore(project.api, (s) => s.format);
  const resolved = junction ? junctions.get(junction.kind) : undefined;
  const live = useJunctionLive(junctionId);
  const source = useMemo(
    () =>
      resolved && junctionLayoutSource(resolved.definition.kind, resolved.definition.properties),
    [resolved],
  );
  const values = useMemo(
    () => (junction ? junctions.resolve(junction, format) : {}),
    [junctions, junction, format],
  );
  if (!junction) return null;

  const display = junctions.display(junction, format);
  const Icon = display.icon;
  const definition = resolved?.definition;
  const limits =
    definition && left && right
      ? durationLimits(definition, project.getState(), left, right)
      : undefined;

  return (
    <>
      <InspectorHeader
        badge={<Icon />}
        title={display.label}
        subtitle={
          display.missing
            ? "Junction"
            : `${definition?.name ?? "Junction"} · ${microsToSeconds(junction.duration).toFixed(1)}s`
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {definition && definition.overlap !== false && limits && (
          <InspectorSection title="Duration">
            <FieldRow label="Duration">
              <NumberField
                label="Duration"
                className="w-full"
                unit="s"
                step={0.1}
                value={Math.round(microsToSeconds(junction.duration) * 1000) / 1000}
                min={microsToSeconds(limits.min)}
                max={microsToSeconds(limits.max)}
                disabled={limits.max < limits.min}
                onChange={(seconds) =>
                  void bus.run(setJunction, junctionSetInput(junction.id, { seconds }))
                }
              />
            </FieldRow>
          </InspectorSection>
        )}
        {source && (
          <PropertyPanel
            subject={{ id: junction.id, kind: junction.kind }}
            source={source}
            values={values}
            live={live}
          />
        )}
        <InspectorSection title="Junction">
          <Button
            size="sm"
            onClick={() => void bus.run(removeJunction, { junctionIds: [junction.id] })}
          >
            <Trash2 />
            Remove
          </Button>
        </InspectorSection>
      </div>
    </>
  );
}
