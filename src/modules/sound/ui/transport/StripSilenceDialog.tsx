import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { formatTimecode } from "@/core";
import { useKernel, useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { Button, Dialog, NumberField, Switch } from "@/ui";
import { SILENCE_DEFAULTS, driftingTracks } from "../../logic/silence";
import { soundRef } from "../../sound.ref";
import { stripSilence } from "../../sound.tools.commands";
import type { ClipCuts, SilenceDialog, SilenceParams } from "../../sound.types";
import { report } from "../report";

/**
 * Strip silence: what counts as silence, what it would cut (drawn on the lanes as it is found,
 * and counted here), and the button that cuts it, as one command. Says so when nothing is found,
 * and then sends nothing. Off the Sound page it closes the gaps, and names the tracks that would
 * drift against the clips when it does.
 */
export function StripSilenceDialog({ target }: { target: SilenceDialog }) {
  const { bus } = useKernel();
  const { view, silences, openSilence } = useModule(soundRef);
  const project = useModule(projectRef).store;
  const { clipIds, soundOnly } = target;
  const [params, setParams] = useState<SilenceParams>(SILENCE_DEFAULTS);
  const [closeGaps, setCloseGaps] = useState(!soundOnly);
  // What was found for one set of values; it is stale as soon as they change.
  const [result, setResult] = useState<{
    params: SilenceParams;
    clips?: ClipCuts[];
    failed?: string;
  } | null>(null);
  const [progress, setProgress] = useState(0);
  const current = result?.params === params ? result : null;
  const found = current?.clips ?? null;
  const failed = current?.failed ?? null;

  useEffect(() => {
    let live = true;
    // Wait for the typing to stop: each look decodes the clips' sound.
    const timer = setTimeout(() => {
      silences
        .scan(clipIds, params, (p) => live && setProgress(p))
        .then(
          (clips) => {
            if (!live) return;
            setResult({ params, clips });
            view.setState((s) => ({
              silence: s.silence && { ...s.silence, cuts: clips.flatMap((c) => c.cuts) },
            }));
          },
          (error: unknown) => {
            if (live) {
              setResult({
                params,
                failed: error instanceof Error ? error.message : JSON.stringify(error),
              });
            }
          },
        );
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
      // Values that changed make this scan stale: stop its FFmpeg.
      silences.cancel();
    };
  }, [clipIds, params, silences, view]);

  const cuts = useMemo(() => found?.flatMap((c) => c.cuts) ?? [], [found]);
  const removed = cuts.reduce((sum, cut) => sum + cut.end - cut.start, 0);
  const state = useStore(project.api, (s) => s);
  const drifting = useMemo(() => {
    if (!closeGaps || soundOnly) return [];
    const clips = (found ?? []).flatMap((c) =>
      c.cuts.length ? (state.clips[c.clipId] ?? []) : [],
    );
    return driftingTracks(state, clips, cuts);
  }, [closeGaps, soundOnly, found, cuts, state]);

  const close = () => openSilence(null);
  const strip = async () => {
    const result = await bus.run(stripSilence, {
      clipIds,
      ...params,
      closeGaps: closeGaps && !soundOnly,
      soundOnly,
    });
    report(result);
    if (result.ok) close();
  };
  const set = (key: keyof SilenceParams) => (value: number) =>
    setParams((p) => ({ ...p, [key]: value }));

  return (
    <Dialog
      title="Strip silence"
      onClose={close}
      footer={
        <>
          <Button size="sm" onClick={close}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={cuts.length === 0}
            onClick={() => void strip()}
          >
            Strip
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        {soundOnly
          ? "Cuts the silent stretches out of the sound and leaves gaps. Pictures stay as they are."
          : "Cuts the silent stretches out of the clips, picture and sound together."}
      </p>
      <div className="grid grid-cols-[1fr_96px] items-center gap-2 text-sm text-muted-foreground">
        Quieter than
        <NumberField
          label="Threshold"
          value={params.thresholdDb}
          min={-90}
          max={0}
          unit="dB"
          onChange={set("thresholdDb")}
        />
        For at least
        <NumberField
          label="Shortest silence"
          value={params.minMs}
          min={10}
          max={60000}
          step={50}
          unit="ms"
          onChange={set("minMs")}
        />
        Keep quiet around sound
        <NumberField
          label="Keep"
          value={params.padMs}
          min={0}
          max={5000}
          step={10}
          unit="ms"
          onChange={set("padMs")}
        />
      </div>
      {!soundOnly && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          Close the gaps
          <Switch label="Close the gaps" checked={closeGaps} onChange={setCloseGaps} />
        </div>
      )}
      <p aria-live="polite" className="text-sm text-foreground">
        {failed
          ? `Could not look for silence: ${failed}`
          : found === null
            ? `Listening... ${Math.round(progress * 100)}%`
            : cuts.length === 0
              ? found.length > 0 && found.every((c) => c.noSound)
                ? "No sound in this clip."
                : "No silence found at this threshold. Raise it, or shorten the shortest silence."
              : `${cuts.length} ${cuts.length === 1 ? "cut" : "cuts"}, ${formatTimecode(removed)} taken out. Shown on the timeline.`}
      </p>
      {drifting.length > 0 && (
        <p className="text-sm text-mark">
          Closing the gaps moves what follows earlier, but {drifting.map((t) => t.name).join(", ")}{" "}
          would stay where {drifting.length === 1 ? "it is" : "they are"} and drift against it.
        </p>
      )}
    </Dialog>
  );
}
