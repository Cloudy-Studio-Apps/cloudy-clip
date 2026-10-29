import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule, usePoint } from "@/core";
import { elementRef, elements as elementPoint } from "@/modules/element";
import { projectRef, type Clip, type Track } from "@/modules/project";
import { CommandItem } from "./CommandItem";
import { useWarnOnce } from "./panel.warn.hook";
import { PropertyPanel } from "./PropertyPanel";
import { usePropsLive } from "./props.live.hook";
import { WarningRow } from "./WarningRow";

/**
 * The sections of a clip's element, generated from its layout (or its properties): each drawn by
 * its section layout, each item by its control. Values are resolved once per clip change; drags
 * only redraw the preview.
 */
export function ElementPanel({ clip, track }: { clip: Clip; track: Track }) {
  const elements = useModule(elementRef);
  const format = useStore(useModule(projectRef).store.api, (s) => s.format);
  // Re-render when elements are registered or removed (a plugin loaded after the panel opened).
  const registered = usePoint(elementPoint);
  const live = usePropsLive(clip);
  const resolved = useMemo(
    () => elements.get(clip.kind),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `registered` invalidates the lookup
    [elements, clip.kind, registered],
  );
  const values = useMemo(() => elements.resolve(clip, format), [elements, clip, format]);
  useWarnOnce(resolved ? null : `no element is registered for "${clip.kind}" clips`);
  if (!resolved) {
    return (
      <div className="p-3">
        <WarningRow
          title="These clips can't be edited."
          detail={`No module provides "${clip.kind}" clips. Its plugin may be missing or turned off.`}
        />
      </div>
    );
  }

  return (
    <PropertyPanel
      subject={clip}
      source={resolved}
      values={values}
      live={live}
      include={(section) => {
        const group = resolved.groups.find((g) => g.id === section.key);
        return !group?.appliesTo || group.appliesTo(clip, track);
      }}
      renderCommand={(item, index) => (
        <CommandItem key={`${item.id}:${index}`} item={item} clip={clip} />
      )}
    />
  );
}
