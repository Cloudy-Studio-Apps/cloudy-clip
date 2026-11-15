import { createLogger, notify } from "@/core";
import type { Composition, PictureSize, ProjectState } from "@/modules/project";
import { GpuUnavailable } from "../gpu/gpu.errors";
import { levelsPass } from "../gpu/gpu.levels";
import type { GpuPass } from "../gpu/gpu.types";
import { chainPasses } from "../logic/chain";
import { filtersReady } from "../logic/readiness";
import type { FilterInfo, FilterPasses, FilterTarget, VideoLevels } from "../preview.types";
import { ShrinkCanvas } from "./engine.shrink";
import type { EngineOptions, FilterSet, FilterSubject } from "./engine.types";

const log = createLogger("preview.filters");

const NO_FILTERS: FilterSet = { picture: [], frame: [] };

/** A thrown value as an `Error`, its message kept. */
function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * The GPU side of one engine's pictures: a video frame's levels, the picture and frame filters,
 * and the viewer's passes. Each picture is uploaded once and every pass it gets runs in that one
 * `run` (a playing video can change between two reads). In the live preview a failure draws the
 * picture without what failed; a capture or an export throws, so its frame fails with the message.
 */
export class EngineFilters {
  /** The levels pass of the last levels asked for, made again only when they change. */
  private correction: { from: VideoLevels; pass: GpuPass } | null = null;
  /** The levels pass failed: told once. */
  private levelsWarned = false;
  /** No WebGL2 for good: nothing runs on the GPU any more. */
  private gone = false;
  /** Where a capped video frame is made smaller before its upload. */
  private readonly opaque = new ShrinkCanvas();
  /** The same for pictures that may be transparent (images, placements). */
  private readonly clear = new ShrinkCanvas(true);

  /** What the capture being drawn passed its filters (`CaptureOptions.filters`). */
  captureOptions: FilterInfo["options"];

  constructor(private readonly options: EngineOptions) {}

  private get target(): FilterTarget {
    return this.options.filterTarget ?? "preview";
  }

  private get set(): FilterSet {
    return this.options.filters?.() ?? NO_FILTERS;
  }

  /** Whether every picture filter applying to the clip can run now. */
  clipReady({ clip, project }: Pick<FilterSubject, "clip" | "project">): boolean {
    return filtersReady(this.set.picture, clip, project);
  }

  /** Whether every frame filter applying to the composition can run now. */
  frameReady(composition: Composition, project: ProjectState): boolean {
    return filtersReady(this.set.frame, composition, project);
  }

  /** The passes of each picture filter applying to the clip, in order, at `size`. */
  forClip({ clip, project, path, time }: FilterSubject, size: PictureSize): FilterPasses[] {
    const info = {
      clip,
      project,
      path,
      size,
      time,
      target: this.target,
      options: this.captureOptions,
    };
    return this.collect(
      this.set.picture.filter((filter) => filter.applies(clip, project, this.captureOptions)),
      (filter) => filter.passes(info),
    );
  }

  /** The passes of each frame filter applying to a composition's frame, in order, at `size`. */
  forFrame(
    composition: Composition,
    project: ProjectState,
    path: string,
    size: PictureSize,
    time: FilterSubject["time"],
  ): FilterPasses[] {
    const info = {
      composition,
      project,
      path,
      size,
      time,
      target: this.target,
      options: this.captureOptions,
    };
    return this.collect(
      this.set.frame.filter((filter) => filter.applies(composition, project, this.captureOptions)),
      (filter) => filter.passes(info),
    );
  }

  /**
   * A video frame through its levels pass (when this webview squeezes them) and `groups`, at
   * `passSize`; the element itself when nothing runs.
   */
  video(
    element: HTMLVideoElement,
    size: PictureSize,
    passSize: PictureSize,
    groups: readonly FilterPasses[],
  ): CanvasImageSource {
    const levels = this.options.videoLevels?.() ?? null;
    if (levels && this.correction?.from !== levels)
      this.correction = { from: levels, pass: levelsPass(levels) };
    const pass = levels ? this.correction!.pass : null;
    return this.run(element, size, passSize, this.opaque, pass, groups);
  }

  /** An image or a placement's canvas through `groups`, at `passSize`; itself when none. */
  picture(
    source: HTMLImageElement | HTMLCanvasElement,
    size: PictureSize,
    passSize: PictureSize,
    groups: readonly FilterPasses[],
  ): CanvasImageSource {
    return this.run(source, size, passSize, this.clear, null, groups);
  }

  /**
   * Runs `groups` over the whole of `ctx`'s canvas and draws the result back on it: frame filters
   * on a composed frame, the viewer's passes on the live canvas.
   */
  over(ctx: CanvasRenderingContext2D, groups: readonly FilterPasses[]): void {
    if (groups.length === 0) return;
    const { canvas } = ctx;
    const size = { width: canvas.width, height: canvas.height };
    const result = this.run(canvas, size, size, this.clear, null, groups);
    if (result === canvas) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(result, 0, 0);
    ctx.restore();
  }

  dispose(): void {
    this.opaque.dispose();
    this.clear.dispose();
  }

  /** Each filter's passes; one that throws is left out (live) or fails the frame. */
  private collect<F extends { id: string }>(
    filters: readonly F[],
    passesOf: (filter: F) => readonly GpuPass[],
  ): FilterPasses[] {
    const groups: FilterPasses[] = [];
    for (const filter of filters) {
      try {
        const passes = passesOf(filter);
        if (passes.length > 0) groups.push({ id: filter.id, passes });
      } catch (error) {
        if (this.target !== "preview") throw asError(error);
        this.options.filterFailed?.(filter.id, error);
      }
    }
    return groups;
  }

  /** Uploads `source` once (smaller first when capped) and runs `levels` then `groups` on it. */
  private run(
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
    size: PictureSize,
    passSize: PictureSize,
    shrink: ShrinkCanvas,
    levels: GpuPass | null,
    groups: readonly FilterPasses[],
  ): CanvasImageSource {
    if (!levels && groups.length === 0) return source;
    // A capture or an export never drops a filter silently; a lost levels pass only looks flat.
    const strict = groups.length > 0 && this.target !== "preview";
    const gpu = this.options.gpu;
    if (!gpu || this.gone) {
      if (strict) throw new GpuUnavailable();
      this.failed(groups, new GpuUnavailable());
      return source;
    }
    try {
      const passes = chainPasses([levels ? [levels] : [], ...groups.map((group) => group.passes)]);
      return gpu.run(shrink.fit(source, size, passSize), passSize, passes);
    } catch (error) {
      if (error instanceof GpuUnavailable) this.gone = true;
      if (strict) throw asError(error);
      if (groups.length === 0) {
        this.warnLevels(error);
        return source;
      }
      this.failed(groups, error);
      // The filters broke it: the levels alone may still run.
      return levels && !this.gone ? this.run(source, size, passSize, shrink, levels, []) : source;
    }
  }

  private failed(groups: readonly FilterPasses[], error: unknown): void {
    for (const { id } of groups) this.options.filterFailed?.(id, error);
  }

  private warnLevels(error: unknown): void {
    if (this.levelsWarned) return;
    this.levelsWarned = true;
    log.warn("Video levels could not be corrected", error);
    notify("info", "Video colors may look a little flat: the graphics card couldn't correct them.");
  }
}
