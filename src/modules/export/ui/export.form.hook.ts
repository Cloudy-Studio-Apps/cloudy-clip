import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { LOCAL_ACTOR, useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef } from "@/modules/project";
import { workspaceRef } from "@/modules/workspace";
import { enqueue } from "../export.commands";
import { exportRef } from "../export.ref";
import { confirmReplace, freeSpace, uniquePath } from "../export.service";
import { estimateBytes, estimateSeconds, formatSize } from "../logic/estimate";
import { formatInfo, joinPath, validName } from "../logic/presets";

/** Past this length a GIF is worth a warning. */
const LONG_GIF_MICROS = 15_000_000;

/** The page's settings with everything that follows from them. */
export function useExportForm() {
  const { bus } = useKernel();
  const api = useModule(exportRef);
  const project = useModule(projectRef);
  const preview = useModule(previewRef);
  const values = useStore(api.form);
  const capabilities = useStore(api.capabilities, (state) => state.value);
  const session = useStore(useModule(workspaceRef).session);
  const records = useStore(project.store.api, (state) => state.compositions);
  const order = useStore(project.store.api, (state) => state.compositionOrder);
  const compositions = useMemo(
    () => order.flatMap((id) => (records[id] ? [records[id]] : [])),
    [order, records],
  );
  const open = useStore(project.view.store, () => project.view.openFor(LOCAL_ACTOR));
  const composition =
    (values.compositionId !== null ? records[values.compositionId] : undefined) ??
    (open !== null ? records[open] : undefined) ??
    compositions[0];

  const name = values.name || session.name;
  const info = formatInfo(values.format);
  const duration = composition?.duration ?? 0;
  const from = values.whole ? 0 : Math.min(values.from, duration);
  const to = values.whole ? duration : Math.min(values.to || duration, duration);
  const length = Math.max(0, to - from);
  const card = values.format === "h265" ? capabilities?.h265Card : capabilities?.h264Card;
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
      },
    [composition, info, length, values.sound, values.effort, hardware],
  );
  const sizeAt = (quality: number) =>
    estimateInput ? formatSize(estimateBytes({ ...estimateInput, quality })) : "—";
  const bytes = estimateInput ? estimateBytes({ ...estimateInput, quality: values.quality }) : 0;
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
  const compositionId = composition?.id;
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
      const file = `${name.trim()}.${info.extension}`;
      const path = joinPath(values.folder, file);
      const taken = (await uniquePath(path)) !== path;
      if (taken && !(await confirmReplace(file))) return;
      ifExists = "replace";
    }
    await bus.run(enqueue, {
      name,
      folder: values.folder,
      compositionId: composition.id,
      format: values.format,
      quality: values.quality,
      effort: values.effort,
      sound: values.sound,
      hardware,
      ifExists,
      reveal: values.reveal,
      ...(!values.whole && { range: { start: from, duration: length } }),
    });
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
    sizeAt,
    blocker,
    note,
    ready,
    add,
  };
}
