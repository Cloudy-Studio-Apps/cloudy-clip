import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { PropertyPanel } from "@/modules/inspector";
import { projectRef, type SubtitleStyle } from "@/modules/project";
import { styleSource } from "./style.source";
import { useStyleLive } from "./style.live.hook";

/** A style's values in the text element's sections plus Position; edits reach its cues at once. */
export function StyleEditor({ style }: { style: SubtitleStyle }) {
  const live = useStyleLive(style.id);
  const clips = useStore(useModule(projectRef).store.api, (s) => s.clips);
  const count = useMemo(
    () => Object.values(clips).filter((c) => c.subtitle?.styleId === style.id).length,
    [clips, style.id],
  );
  const values = useMemo(() => ({ ...style.props, position: style.position }), [style]);

  return (
    <>
      <p className="border-b border-dashed border-border-strong px-3 pb-2 pt-1.5 text-xs text-subtle-foreground">
        Editing <b className="text-muted-foreground">{style.name}</b> changes its {count} cue
        {count === 1 ? "" : "s"} at once, in one undo step. A value a cue set on its own (◆) stays.
      </p>
      <PropertyPanel
        subject={{ id: style.id, kind: "subtitle-style" }}
        source={styleSource}
        values={values}
        live={live}
      />
    </>
  );
}
