import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { Button, FoldSection, Switch } from "@/ui";
import { mediaRef } from "../media.ref";
import { useLibraryRows } from "./library.rows.hook";
import { FileFactsSection } from "./FileFactsSection";
import { MetadataSection } from "./MetadataSection";

/** The Media page's right column under the viewer: the selected file, and walking the unsorted. */
export function FileInfoPanel() {
  const { view } = useModule(mediaRef);
  const selected = useStore(view, (s) => s.selection[0]);
  const autoNext = useStore(view, (s) => s.autoNext);
  const media = useStore(useModule(projectRef).store.api, (s) => s.media);
  const rows = useLibraryRows();
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  const next = useMemo(() => {
    const files = rows.filter(({ type }) => type === "media");
    const at = files.findIndex(({ id }) => id === selected);
    const later = [...files.slice(at + 1), ...files.slice(0, Math.max(at, 0))];
    return later.find(({ id }) => !media[id]?.info?.tag)?.id;
  }, [rows, selected, media]);
  const goNext = () => {
    if (next) view.setState({ selection: [next] });
  };

  if (selected === undefined || !media[selected]) {
    return (
      <p className="m-3 text-center text-muted-foreground">Select a file to see what it holds.</p>
    );
  }
  const fold = (title: string) => ({
    title,
    open: !closed[title],
    onToggle: () => setClosed((now) => ({ ...now, [title]: !now[title] })),
  });
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <FoldSection {...fold("File")}>
        <FileFactsSection mediaId={selected} />
      </FoldSection>
      <FoldSection {...fold("Metadata")}>
        <MetadataSection mediaId={selected} onTagged={autoNext ? goNext : undefined} />
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-dashed border-border-strong pt-2.5 text-sm text-subtle-foreground">
          <label className="flex items-center gap-1.5">
            <Switch
              label="Auto-select next unsorted clip"
              checked={autoNext}
              onChange={(value) => view.setState({ autoNext: value })}
            />
            Auto-select next unsorted clip
          </label>
          <Button size="sm" disabled={!next} onClick={goNext}>
            Next clip
          </Button>
        </div>
      </FoldSection>
    </div>
  );
}
