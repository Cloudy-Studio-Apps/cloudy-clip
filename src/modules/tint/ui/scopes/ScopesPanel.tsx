import { useEffect, useRef } from "react";
import { ChartArea, ChartColumn, Activity } from "lucide-react";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { SegmentedControl } from "@/ui";
import type { ScopeKind } from "../../tint.types";
import { HeaderGap } from "../HeaderGap";
import { PanelNote } from "../PanelNote";
import { TintPanel } from "../TintPanel";
import { useTintView } from "../view.hook";
import { useTintSet } from "../view.set.hook";
import { ScopeCanvas } from "./ScopeCanvas";
import { createScopePainter } from "./scope.draw";
import { startScopesLoop } from "./scopes.loop";

/**
 * Parade, waveform or histogram, with the vectorscope always beside it, drawn from the preview's
 * real frame by one loop (`startScopesLoop`). The canvases are painted directly: no React state per
 * frame. The graticule color is the `--border` token, read once and again when `data-theme` changes.
 */
export function ScopesPanel() {
  const scope = useTintView((v) => v.scope);
  const set = useTintSet();
  const preview = useModule(previewRef);
  const main = useRef<HTMLCanvasElement>(null);
  const vector = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvases = [main.current, vector.current];
    if (canvases.some((el) => !el)) return;
    const paint = createScopePainter();
    let grid: string | null = null;
    const fit = (el: HTMLCanvasElement) => {
      const ratio = window.devicePixelRatio || 1;
      el.width = Math.max(10, Math.round(el.clientWidth * ratio));
      el.height = Math.max(10, Math.round(el.clientHeight * ratio));
    };
    for (const el of canvases) fit(el!);
    const loop = startScopesLoop(preview, (frame) => {
      if (main.current) grid ??= getComputedStyle(main.current).getPropertyValue("--border").trim();
      [main.current, vector.current].forEach((el, i) => {
        const ctx = el?.getContext("2d");
        if (el && ctx)
          paint(ctx, i === 0 ? scope : "vector", frame, el.width, el.height, grid ?? "");
      });
    });
    const resize = new ResizeObserver(() => {
      for (const el of [main.current, vector.current]) if (el) fit(el);
      loop.invalidate();
    });
    for (const el of canvases) resize.observe(el!);
    const theme = new MutationObserver(() => {
      grid = null;
      loop.invalidate();
    });
    theme.observe(document.documentElement, { attributeFilter: ["data-theme"] });
    return () => {
      loop.stop();
      resize.disconnect();
      theme.disconnect();
    };
  }, [preview, scope]);
  return (
    <TintPanel
      header={
        <>
          Scopes
          <SegmentedControl<ScopeKind>
            label="Scope"
            className="ml-3"
            value={scope}
            onChange={(next) => set({ scope: next })}
            options={[
              {
                value: "parade",
                label: "Parade",
                icon: ChartColumn,
                hint: "Red, green and blue side by side. Level lines mean neutral.",
              },
              {
                value: "wave",
                label: "Waveform",
                icon: Activity,
                hint: "Brightness across the picture: bottom black, top white.",
              },
              {
                value: "hist",
                label: "Histogram",
                icon: ChartArea,
                hint: "How many pixels sit at each brightness.",
              },
            ]}
          />
          <HeaderGap />
          <PanelNote>Vectorscope · gold line is skin</PanelNote>
        </>
      }
    >
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-2 p-2">
        <ScopeCanvas ref={main} kind={scope} />
        <ScopeCanvas ref={vector} kind="vector" />
      </div>
    </TintPanel>
  );
}
