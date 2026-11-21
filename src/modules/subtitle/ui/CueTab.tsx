import { useMemo } from "react";
import { useStore } from "zustand";
import { report, useKernel, useModule } from "@/core";
import { elementRef } from "@/modules/element";
import { PropertyPanel } from "@/modules/inspector";
import { formatOf, projectRef } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { Button, SelectField } from "@/ui";
import { mark, resetToStyle, unmark } from "../subtitle.mark.commands";
import { subtitleRef } from "../subtitle.ref";
import { addStyle } from "../subtitle.style.commands";
import { useCuesLive } from "./cues.live.hook";
import { cueSource } from "./style.source";
import { useStyles } from "./styles.hook";

/**
 * The Cue tab: the selected cues' style, their look (from the first, edited together), Reset all
 * to style, New style from this cue and Remove from subtitles.
 */
export function CueTab() {
  const { bus } = useKernel();
  const { view } = useModule(subtitleRef);
  const project = useModule(projectRef).store;
  const elements = useModule(elementRef);
  const selection = useStore(useModule(timelineRef).view, (s) => s.selection);
  const clips = useStore(project.api, (s) => s.clips);
  const { styles } = useStyles();
  const ids = useMemo(
    () => selection.filter((id) => clips[id]?.subtitle !== undefined),
    [selection, clips],
  );
  const live = useCuesLive(ids);
  const first = ids[0] === undefined ? undefined : clips[ids[0]];
  const values = useMemo(
    () => (first ? elements.resolve(first, formatOf(project.getState(), first)) : {}),
    [elements, project, first],
  );
  if (!first?.subtitle) {
    return (
      <p className="px-3 py-4 text-xs text-subtle-foreground">
        Select a cue in the list, the frame or the timeline.
      </p>
    );
  }
  const styleId = first.subtitle.styleId;
  const styleName = styles.find((s) => s.id === styleId)?.name ?? "";

  return (
    <>
      <h4 className="px-3 pb-0.5 pt-2.5 font-hand text-[13.5px] font-bold">
        {ids.length > 1 ? `${ids.length} cues selected` : "One cue"}
      </h4>
      <label className="flex items-center justify-between gap-2 px-3 py-1 text-sm text-muted-foreground">
        Style
        <SelectField
          label="Style"
          value={styleId}
          options={styles.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(id) => void bus.run(mark, { clipIds: ids, styleId: id }).then(report)}
        />
      </label>
      <p className="border-b border-dashed border-border-strong px-3 pb-2 pt-1.5 text-xs text-subtle-foreground">
        Values marked ◆ are {ids.length > 1 ? "these cues'" : "this cue's"} own. The rest follow{" "}
        <b className="text-muted-foreground">{styleName}</b>.
      </p>
      <PropertyPanel
        subject={{ id: first.id, kind: first.kind }}
        source={cueSource}
        values={values}
        live={live}
      />
      <div className="flex flex-wrap gap-1.5 px-3 py-2">
        <Button size="sm" onClick={() => void bus.run(resetToStyle, { clipIds: ids }).then(report)}>
          Reset all to style
        </Button>
        <Button
          size="sm"
          onClick={async () => {
            const made = report(await bus.run(addStyle, { fromClipId: first.id }));
            if (made) view.setState({ styleId: made.styleId, tab: "style" });
          }}
        >
          New style from this cue
        </Button>
        <Button size="sm" onClick={() => void bus.run(unmark, { clipIds: ids }).then(report)}>
          Remove from subtitles
        </Button>
      </div>
    </>
  );
}
