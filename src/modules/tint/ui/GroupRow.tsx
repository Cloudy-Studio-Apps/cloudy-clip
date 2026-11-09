import { Eye, EyeOff, Folder, Plus, Ungroup } from "lucide-react";
import { BLEND_MODES, type BlendMode } from "@/modules/project";
import { IconButton, SelectField, cn } from "@/ui";
import { blendName } from "../logic/layers";
import type { StackItem } from "../tint.types";
import { useLayers } from "./layers.context";
import { OpacityScrub } from "./OpacityScrub";
import { StackItems } from "./StackItems";
import { CHANNEL_COLORS } from "./tools/channel.colors";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

type Group = Extract<StackItem, { type: "group" }>;

const KIND_NAMES: Record<Group["kind"], string> = {
  parallel: "Side by side",
  layer: "Stacked",
  channels: "Per channel",
};

const KIND_NOTES: Record<Group["kind"], string> = {
  parallel: "Each branch starts from the picture above; their changes are added together.",
  layer:
    "Each branch starts from the picture above and lands over the ones before it by its blend; the last is on top.",
  channels:
    "Each branch grades one channel of the picture above as gray; together they make the color again.",
};

const CHANNEL_NAMES = ["Red", "Green", "Blue"] as const;
const BLEND_OPTIONS = BLEND_MODES.map((mode) => ({ value: mode, label: blendName(mode) }));

/**
 * A group of layers: a folder with its kind, opacity and on/off (side by side and stacked), each
 * branch's blend (stacked), its branches indented with an add at the bottom of each, and ungroup.
 */
export function GroupRow({ group }: { group: Group }) {
  const { clipId, grade, actions } = useLayers();
  const join = grade.nodes[group.id];
  const mixes = join?.kind === "parallel" || join?.kind === "layer";
  const on = mixes ? join.on : true;
  const Visible = on ? Eye : EyeOff;
  const selected = useTintView((v) => v.selected === group.id);
  const set = useTintSet();
  const setBlend = (index: number, mode: BlendMode) => {
    if (join?.kind !== "layer") return;
    void actions.changeGroup(group.id, {
      blends: join.blends.map((blend, i) => (i === index ? mode : blend)),
    });
  };
  return (
    <div
      className={cn(
        "rounded-sm bg-primary-soft/20 px-2 pt-1.5 pb-2",
        selected
          ? "shadow-[inset_0_0_0_1.5px_var(--mark)]"
          : "shadow-[inset_0_0_0_1px_var(--border-strong)]",
      )}
    >
      <div className="flex items-center gap-1.5 px-0.5 pt-1 pb-2">
        <button
          type="button"
          onClick={() => set({ selected: group.id })}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left font-hand text-base font-bold"
        >
          <Folder className="size-4 shrink-0 text-primary" />
          <span className="truncate">{KIND_NAMES[group.kind]} group</span>
        </button>
        {mixes && (
          <>
            <OpacityScrub clipId={clipId} nodeId={group.id} opacity={join.opacity} group />
            <IconButton
              label={on ? "On: click to turn the group off" : "Off: click to turn the group on"}
              onClick={() => void actions.changeGroup(group.id, { on: !on })}
            >
              <Visible />
            </IconButton>
          </>
        )}
        <IconButton
          label="Ungroup: its layers stay, in a row"
          onClick={() => actions.ungroup(group.id)}
        >
          <Ungroup />
        </IconButton>
      </div>
      <div className="ml-2.5 flex flex-col gap-2 border-l-[1.5px] border-dashed border-border-strong pl-3">
        {group.branches.map((branch, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <div className="flex h-6 items-center gap-2 text-xs text-muted-foreground">
              {group.kind === "channels" ? (
                <>
                  <span
                    className="size-2 rounded-xs"
                    style={{ background: CHANNEL_COLORS[index] }}
                  />
                  {CHANNEL_NAMES[index]}
                </>
              ) : (
                <>Branch {index + 1}</>
              )}
              {join?.kind === "layer" && (
                <SelectField
                  label={`Blend of branch ${index + 1}`}
                  value={join.blends[index] ?? "normal"}
                  options={BLEND_OPTIONS}
                  onChange={(mode) => setBlend(index, mode as BlendMode)}
                  className="ml-auto h-6 text-xs"
                />
              )}
            </div>
            {branch.length === 0 ? (
              <p className="px-1 text-xs text-subtle-foreground">
                Empty: the picture passes as it is.
              </p>
            ) : (
              <StackItems items={branch} nested />
            )}
            <button
              type="button"
              onClick={() => void actions.add({ branch: { group: group.id, index } })}
              className="flex w-fit cursor-pointer items-center gap-1 px-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3" /> Correction
            </button>
          </div>
        ))}
      </div>
      <p className="pt-2 pl-6 text-xs text-subtle-foreground">{KIND_NOTES[group.kind]}</p>
    </div>
  );
}
