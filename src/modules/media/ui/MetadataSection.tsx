import { X } from "lucide-react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { projectRef, type MediaInfo } from "@/modules/project";
import { SegmentedControl, cn } from "@/ui";
import { renameMedia, setInfo } from "../media.info.commands";
import { useFileFacts } from "./file.facts.hook";
import { MetadataField } from "./MetadataField";

const CLIP_COLORS = [
  "#e8772e",
  "#f0a43a",
  "#e3bd2f",
  "#b7c936",
  "#6f9a3a",
  "#3f9b6e",
  "#2aa5a0",
  "#2f6fb0",
  "#5f9fd6",
  "#8f7ac8",
  "#d4488f",
  "#e88fb5",
  "#c9b79a",
  "#d9a77e",
  "#a8722a",
  "#8a5a3c",
];
const TEXTS = ["camera", "reel", "scene", "shot", "take"] as const;
const TAGS = [
  { value: "good", label: "Good take" },
  { value: "none", label: "Untagged" },
  { value: "rejected", label: "Rejected" },
] as const;

const SWATCH = "grid size-4 cursor-pointer place-items-center rounded-xs text-subtle-foreground";

interface MetadataSectionProps {
  mediaId: string;
  /** Fires after a tag was set, so a list can move on. */
  onTagged?(): void;
}

/** What you note about a file, shared by all its clips. Every change is one undo step. */
export function MetadataSection({ mediaId, onTagged }: MetadataSectionProps) {
  const { bus } = useKernel();
  const asset = useStore(useModule(projectRef).store.api, (s) => s.media[mediaId]);
  const facts = useFileFacts(mediaId);
  if (!asset) return null;
  const info: MediaInfo = asset.info ?? {};
  const patch = (next: Parameters<typeof setInfo.run>[1]["patch"]) =>
    void bus.run(setInfo, { mediaId, patch: next });
  const written = (value: string) => value.trim() || null;
  const created = facts.createdAt ? new Date(facts.createdAt).toISOString().slice(0, 10) : "";

  return (
    <div className="flex flex-col">
      <MetadataField label="Timecode" value={facts.timecode ?? ""} />
      <MetadataField label="Date created" value={created} />
      {TEXTS.map((field) => (
        <MetadataField
          key={field}
          label={field[0]!.toUpperCase() + field.slice(1)}
          value={info[field] ?? ""}
          onCommit={(value) => patch({ [field]: written(value) })}
        />
      ))}
      <div className="flex flex-col gap-[3px] py-1 text-muted-foreground">
        Tag
        <SegmentedControl
          label="Tag"
          options={TAGS}
          value={info.tag ?? "none"}
          onChange={(tag) => {
            patch({ tag: tag === "none" ? null : tag });
            if (tag !== "none") onTagged?.();
          }}
        />
      </div>
      <div className="grid grid-cols-[74px_minmax(0,1fr)] gap-1.5 pt-1.5 text-muted-foreground">
        Clip color
        <div role="group" aria-label="Clip color" className="grid grid-cols-9 gap-y-1.5">
          <button
            type="button"
            title="No color"
            aria-label="No color"
            aria-pressed={!info.color}
            className={cn(
              SWATCH,
              !info.color && "ring-2 ring-foreground ring-offset-2 ring-offset-surface",
            )}
            onClick={() => patch({ color: null })}
          >
            <X className="size-3" />
          </button>
          {CLIP_COLORS.map((color, index) => (
            <button
              key={color}
              type="button"
              aria-label={`Color ${index + 1}`}
              aria-pressed={info.color === color}
              style={{ backgroundColor: color }}
              className={cn(
                SWATCH,
                info.color === color && "ring-2 ring-foreground ring-offset-2 ring-offset-surface",
              )}
              onClick={() => patch({ color })}
            />
          ))}
        </div>
      </div>
      <MetadataField
        label="Name"
        value={asset.name}
        onCommit={(name) => {
          if (name.trim()) void bus.run(renameMedia, { mediaId, name });
        }}
      />
      <MetadataField
        long
        label="Comments"
        value={info.comments ?? ""}
        onCommit={(value) => patch({ comments: written(value) })}
      />
    </div>
  );
}
