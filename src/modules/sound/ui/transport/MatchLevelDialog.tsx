import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { Button, Dialog } from "@/ui";
import { levelPlan } from "../../logic/level";
import { soundRef } from "../../sound.ref";
import { matchLevel } from "../../sound.tools.commands";
import type { ClipLoudness, MatchDialog } from "../../sound.types";
import { report } from "../report";

const db = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)} dB`;

/**
 * Match level: measures the clips' loudness (as heard through their own volume), shows
 * each one's loudness and the change it will get, and applies them as one command. Nothing changes
 * until Match is pressed; clips with no sound or silent are listed as left alone.
 */
export function MatchLevelDialog({ target }: { target: MatchDialog }) {
  const { bus } = useKernel();
  const { loudness, openMatch } = useModule(soundRef);
  const project = useModule(projectRef).store;
  const state = useStore(project.api, (s) => s);
  const { clipIds } = target;
  const [measured, setMeasured] = useState<ClipLoudness[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let live = true;
    loudness
      .measure(clipIds, (p) => live && setProgress(p))
      .then(
        (clips) => live && setMeasured(clips),
        (error: unknown) => {
          if (live) setFailed(error instanceof Error ? error.message : JSON.stringify(error));
        },
      );
    return () => {
      live = false;
      loudness.cancel();
    };
  }, [clipIds, loudness]);

  const plan = useMemo(() => (measured ? levelPlan(state, measured) : null), [state, measured]);
  const nameOf = (id: string) => {
    const mediaId = state.clips[id]?.mediaId;
    return (mediaId && state.media[mediaId]?.name) || id;
  };
  const close = () => openMatch(null);
  const apply = async () => {
    const result = await bus.run(matchLevel, { clipIds });
    report(result);
    if (result.ok) close();
  };

  return (
    <Dialog
      title="Match level"
      onClose={close}
      footer={
        <>
          <Button size="sm" onClick={close}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!plan || plan.changes.length === 0}
            onClick={() => void apply()}
          >
            Match
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        Brings the clips to the loudness of the loudest one, turning their volume up or down. A clip
        with volume keys keeps its curve and moves every key by the same amount.
      </p>
      <p aria-live="polite" className="text-sm text-foreground">
        {failed
          ? `Could not measure: ${failed}`
          : !plan
            ? `Measuring... ${Math.round(progress * 100)}%`
            : plan.changes.length === 0
              ? "No clip with sound to match."
              : `Target ${plan.target!.toFixed(1)} LUFS`}
      </p>
      {plan && (
        <ul className="flex flex-col gap-1 text-sm">
          {plan.changes.map((c) => (
            <li key={c.clipId} className="flex justify-between gap-3">
              <span className="truncate text-foreground">{nameOf(c.clipId)}</span>
              <span className="shrink-0 text-muted-foreground">
                {c.lufs.toFixed(1)} LUFS, {db(c.deltaDb)}
                {c.volumeDb === null ? " (keys)" : ""}
                {c.clamped ? " (limit)" : ""}
              </span>
            </li>
          ))}
          {plan.skipped.map((s) => (
            <li key={s.clipId} className="flex justify-between gap-3 text-muted-foreground">
              <span className="truncate">{nameOf(s.clipId)}</span>
              <span className="shrink-0">{s.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
