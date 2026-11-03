import { Maximize, Minimize } from "lucide-react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { Button } from "@/ui";
import { soundRef } from "../../sound.ref";
import { MixerFilter } from "./MixerFilter";

/**
 * The mixer's header: "Mixer", the strip filter, how many strips there are (Master counted) and
 * Expand all / Back to timeline.
 */
export function MixerBar({ strips }: { strips: number }) {
  const sound = useModule(soundRef);
  const expanded = useStore(sound.view, (s) => s.expanded);
  return (
    <header className="flex h-[34px] shrink-0 items-center gap-3.5 border-b border-border-strong bg-muted pl-3 pr-2">
      <h3 className="font-hand text-md font-bold">Mixer</h3>
      <MixerFilter />
      <span className="flex-1" />
      <span className="whitespace-nowrap font-mono text-sm text-muted-foreground">
        {strips} strips
      </span>
      <Button
        size="sm"
        variant={expanded ? "primary" : "secondary"}
        onClick={() => sound.setExpanded(!expanded)}
      >
        {expanded ? <Minimize /> : <Maximize />}
        {expanded ? "Back to timeline" : "Expand all"}
      </Button>
    </header>
  );
}
