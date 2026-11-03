import { useKernel } from "@/core";
import type { CompositionId, SoundEffect } from "@/modules/project";
import { cn } from "@/ui";
import { chainSlot } from "../logic/chain";
import { chainWhere, EFFECT_NAMES } from "../logic/effects";
import { moveEffect } from "../sound.effects.commands";
import type { MixTarget } from "../sound.types";
import { AddEffectMenu } from "./AddEffectMenu";
import { startChainDrag } from "./chain.gesture";
import { DenoiseMark } from "./DenoiseMark";

/** The height of a row, in px; a drag counts rows by it. */
const ROW = 19;

interface EffectChainProps {
  target: MixTarget;
  compositionId: CompositionId | undefined;
  effects: readonly SoundEffect[];
}

/**
 * A strip's effects in signal order, each with a dot in `--on` while it works, and `+ Effect`. A
 * row dragged up or down moves the effect there with one `sound.moveEffect` on release. Noise
 * reduction says how far its files are rendered.
 */
export function EffectChain({ target, compositionId, effects }: EffectChainProps) {
  const { bus } = useKernel();
  const where = chainWhere(target, compositionId);

  return (
    <div
      role="list"
      aria-label="Effects"
      className="flex h-[98px] shrink-0 flex-col overflow-y-auto"
    >
      {effects.map((effect, index) => (
        <div
          key={effect.id}
          role="listitem"
          style={{ height: ROW }}
          title={`${EFFECT_NAMES[effect.kind].name}${effect.on ? "" : " (off)"}: drag to reorder`}
          className="relative flex shrink-0 cursor-grab touch-none items-center gap-[5px] overflow-hidden whitespace-nowrap border-b border-border bg-surface text-sm text-muted-foreground"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            startChainDrag({
              down: event.nativeEvent,
              row: event.currentTarget,
              onEnd(dy) {
                if (dy === null) return;
                const to = chainSlot(index, dy, ROW, effects.length);
                if (to === index) return;
                void bus.run(moveEffect, { ...where, effectId: effect.id, to });
              },
            });
          }}
        >
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0 rounded-xs",
              effect.on ? "bg-on" : "shadow-[inset_0_0_0_1px_var(--border-strong)]",
            )}
          />
          <span className={cn("truncate", !effect.on && "text-subtle-foreground")}>
            {EFFECT_NAMES[effect.kind].short}
          </span>
          {effect.kind === "denoise" && (
            <DenoiseMark target={target} compositionId={compositionId} effect={effect} />
          )}
        </div>
      ))}
      <AddEffectMenu
        target={target}
        compositionId={compositionId}
        chain={effects}
        trigger={
          <button
            type="button"
            style={{ height: ROW }}
            className="flex w-full shrink-0 cursor-pointer items-center border-b border-dashed border-border-strong text-left text-sm text-subtle-foreground hover:text-foreground"
          >
            + Effect
          </button>
        }
      />
    </div>
  );
}
