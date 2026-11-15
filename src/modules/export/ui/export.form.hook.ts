import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { notify, useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { workspaceRef } from "@/modules/workspace";
import { enqueue } from "../export.commands";
import { exportRef } from "../export.ref";
import { confirmReplace, freeSpace, uniquePath } from "../export.service";
import { estimateBytes, estimateSeconds, formatSize } from "../logic/estimate";
import { fileName, formatInfo, hasBitDepth, joinPath, validName } from "../logic/presets";
import { fileSuffixes } from "../logic/stems";
import { useExportComposition } from "./export.composition.hook";

/** Past this length a GIF is worth a warning. */
const LONG_GIF_MICROS = 15_000_000;

/** The page's settings with everything that follows from them. */
export function useExportForm() {
  const { bus } = useKernel();
  const api = useModule(exportRef);
  const preview = useModule(previewRef);
  const values = useStore(api.form);
  const capabilities = useStore(api.capabilities, (state) => state.value);
  const session = useStore(useModule(workspaceRef).session);
  const { composition, compositions, stems: stemPlan, groups } = useExportComposition();

  const name = values.name || session.name;
  const info = formatInfo(values.format);
  const duration = composition?.duration ?? 0;
  const from = values.whole ? 0 : Math.min(values.from, duration);
  const to = values.whole ? duration : Math.min(values.to || duration, duration);
  const length = Math.max(0, to - from);
  const card = values.format === "h265" ? capabilities?.h265Card : capabilities?.h264Card;
  // Stems are sound only, and need a group; a format with a picture keeps the choice for when
  // it's back.
  const stems = values.stems && !info.picture && groups;
  const compositionId = composition?.id;
  const plan = stems ? stemPlan : null;
  const hardware = values.hardware && Boolean(card);

  const estimateInput = useMemo(
    () =>
      composition && {
        format: composition.format,
        info,
        duration: length,
        sound: values.sound,
        effort: values.effort,
        hardware,
        sampleRate: values.sampleRate,
        bitDepth: values.bitDepth,
      },
    [
      composition,
      info,
      length,
      values.sound,
      values.effort,
      hardware,
      values.sampleRate,
      values.bitDepth,
    ],
  );
  const sizeAt = (quality: number) =>
    estimateInput ? formatSize(estimateBytes({ ...estimateInput, quality })) : "—";
  // Each stem is about as big as the mix.
  const files = 1 + (plan?.length ?? 0);
  const bytes = estimateInput
    ? files * estimateBytes({ ...estimateInput, quality: values.quality })
    : 0;
  const seconds = estimateInput
    ? estimateSeconds({ ...estimateInput, quality: values.quality })
    : 0;

  const [free, setFree] = useState<number | null>(null);
  useEffect(() => {
    let current = true;
    freeSpace(values.folder || ".").then(
      (space) => current && setFree(space),
      () => current && setFree(null),
    );
    return () => {
      current = false;
    };
  }, [values.folder]);

  const [picture, setPicture] = useState<string | null>(null);
  useEffect(() => {
    if (!compositionId) return;
    let current = true;
    const at = Math.min(preview.playback.getTime(), Math.max(0, duration - 1));
    preview.captureAt(at, compositionId).then(
      (data) => current && setPicture(`data:image/png;base64,${data}`),
      () => current && setPicture(null),
    );
    return () => {
      current = false;
    };
  }, [compositionId, duration, preview]);

  const blocker = !capabilities?.ffmpeg
    ? null
    : !validName(name)
      ? "Give the video a name a file can have."
      : !values.folder.trim()
        ? "Choose a folder."
        : length <= 0
          ? "The end has to be after the start."
          : free !== null && bytes > free
            ? "This file would not fit on the disk."
            : null;
  const { width, height } = composition?.format ?? { width: 0, height: 0 };
  const note =
    values.format === "gif" && length > LONG_GIF_MICROS
      ? "Long GIFs get very large. MP4 is a better fit."
      : info.picture && values.format !== "gif" && (width % 2 === 1 || height % 2 === 1)
        ? "This format needs an even size, so the picture loses 1 pixel."
        : null;
  const ready = Boolean(composition && capabilities?.ffmpeg && !blocker);

  async function add(): Promise<void> {
    if (!composition || !ready) return;
    let { ifExists } = values;
    if (ifExists === "ask") {
      const paths = fileSuffixes(plan).map((suffix) =>
        joinPath(values.folder, `${name.trim()}${suffix}.${info.extension}`),
      );
      const free = await Promise.all(paths.map(uniquePath));
      const taken = paths.filter((path, i) => free[i] !== path).map(fileName);
      if (taken.length > 0 && !(await confirmReplace(taken.join(", ")))) return;
      ifExists = "replace";
    }
    const result = await bus.run(enqueue, {
      name,
      folder: values.folder,
      compositionId: composition.id,
      format: values.format,
      quality: values.quality,
      effort: values.effort,
      sound: values.sound,
      stems,
      matchTarget: values.matchTarget && info.sound && values.sound && api.canMatchTarget(),
      hardware,
      sampleRate: values.sampleRate,
      ...(hasBitDepth(values.format) && { bitDepth: values.bitDepth }),
      ifExists,
      reveal: values.reveal,
      ...(!values.whole && { range: { start: from, duration: length } }),
    });
    if (!result.ok) notify("error", result.error.message);
  }

  return {
    values,
    capabilities,
    compositions,
    composition,
    name,
    info,
    from,
    to,
    length,
    free,
    bytes,
    seconds,
    picture,
    plan,
    groups,
    sizeAt,
    blocker,
    note,
    ready,
    add,
  };
}
