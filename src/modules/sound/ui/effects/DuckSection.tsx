import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { FieldRow } from "@/modules/inspector";
import { EFFECT_RANGES, projectRef, type DuckEffect } from "@/modules/project";
import { cn } from "@/ui";
import { defaultSpec } from "../../logic/effects";
import type { DuckOwner, EffectEdit } from "../../sound.types";
import { EffectRow } from "./EffectRow";
import { EffectSection } from "./EffectSection";

const REST = defaultSpec("duck");

interface DuckSectionProps {
  effect: DuckEffect;
  /** The track or group it lowers. */
  owner: DuckOwner;
  edit: EffectEdit;
}

/**
 * Ducking on a track or a group: the tracks and groups it listens to (their sound together lowers
 * this one), how far and how fast. A choice that would make a loop is refused by
 * `sound.setEffect`, and the user is told why.
 */
export function DuckSection({ effect, owner, edit }: DuckSectionProps) {
  const project = useModule(projectRef).store;
  const composition = useStore(project.api, (s) => s.compositions[owner.compositionId]);
  const tracks = useStore(project.api, (s) => s.tracks);
  const others = useMemo(() => {
    const audio = (composition?.trackOrder ?? []).flatMap((id) => {
      const track = tracks[id];
      return track?.kind === "audio" ? [{ id, name: track.name }] : [];
    });
    const groups = (composition?.mix?.buses ?? []).map(({ id, name }) => ({ id, name }));
    return [...audio, ...groups].filter(({ id }) => id !== owner.id);
  }, [composition, owner.id, tracks]);
  const toggle = (id: string) => {
    const listensTo = effect.listensTo.includes(id)
      ? effect.listensTo.filter((one) => one !== id)
      : [...effect.listensTo, id];
    void edit.commit(effect.id, { listensTo });
  };
  const timing = (key: "attackMs" | "releaseMs", label: string) => (
    <EffectRow
      label={label}
      value={effect[key]}
      rest={REST[key]}
      {...EFFECT_RANGES.duck[key]}
      step={0.01}
      unit="ms"
      scale="log"
      disabled={!effect.on}
      edit={edit}
      write={(value) => ({ effect: { ...effect, [key]: value }, patch: { [key]: value } })}
    />
  );

  return (
    <EffectSection effect={effect} edit={edit}>
      <FieldRow label="Listens to">
        {others.length === 0 ? (
          <span className="text-sm text-subtle-foreground">No other audio track or group here</span>
        ) : (
          <div className="flex min-w-0 flex-wrap gap-1">
            {others.map((track) => {
              const on = effect.listensTo.includes(track.id);
              return (
                <button
                  key={track.id}
                  type="button"
                  aria-pressed={on}
                  disabled={!effect.on}
                  className={cn(
                    "h-5 max-w-full cursor-pointer truncate rounded-xs px-1.5 text-sm disabled:cursor-default disabled:opacity-50",
                    on
                      ? "bg-foreground text-surface"
                      : "text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)] hover:text-foreground",
                  )}
                  onClick={() => toggle(track.id)}
                >
                  {track.name}
                </button>
              );
            })}
          </div>
        )}
      </FieldRow>
      <EffectRow
        label="By"
        value={effect.depthDb}
        rest={REST.depthDb}
        {...EFFECT_RANGES.duck.depthDb}
        step={0.5}
        unit="dB"
        disabled={!effect.on}
        edit={edit}
        write={(depthDb) => ({ effect: { ...effect, depthDb }, patch: { depthDb } })}
      />
      {timing("attackMs", "Attack")}
      {timing("releaseMs", "Release")}
    </EffectSection>
  );
}
