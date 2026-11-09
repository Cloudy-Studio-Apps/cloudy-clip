// TEMPORARY (Task 1 check): removed before the commit.
import { z } from "zod";
import { createLogger, defineMcpTool, errorResult, notify, textResult, toAppError } from "@/core";
import { mediaRef } from "@/modules/media";
import { projectRef } from "@/modules/project";
import { previewRef } from "../preview.ref";
import { checkCaps } from "./gpu.check.caps";
import { checkHidden } from "./gpu.check.hidden";
import { checkTiming } from "./gpu.check.timing";
import { checkLevels, checkVideo } from "./gpu.check.video";

const log = createLogger("preview.gpu");

/** Dev only: runs one part of the WebGL2 check and returns what it measured. */
export const gpuCheck = defineMcpTool({
  name: "preview_gpu_check",
  readOnly: true,
  description: "Dev only. Runs one part of the WebGL2 check and returns the measurements as JSON.",
  input: z.object({
    part: z.enum(["caps", "video", "levels", "hidden", "timing"]),
    videoMediaId: z.string().optional(),
    levelsMediaId: z.string().optional(),
    seconds: z.number().min(1).max(25).optional(),
  }),
  async handler({ part, videoMediaId, levelsMediaId, seconds }, ctx) {
    const media = ctx.require(mediaRef);
    const url = (id: string | undefined) => (id ? media.mediaUrl(id) : null);
    try {
      let result: unknown;
      if (part === "caps") result = checkCaps();
      else if (part === "video") result = await checkVideo(url(videoMediaId)!);
      else if (part === "levels") result = await checkLevels(url(levelsMediaId)!);
      else if (part === "timing") result = await checkTiming(url(videoMediaId));
      else {
        const project = ctx.require(projectRef);
        const composition = project.view.requireOpen(ctx.caller.key);
        const renderer = ctx.require(previewRef).createRenderer({
          project: project.store.getState(),
          compositionId: composition.id,
        });
        try {
          result = await checkHidden(
            renderer,
            { width: composition.format.width, height: composition.format.height },
            composition.duration,
            seconds ?? 20,
            url(videoMediaId),
          );
        } finally {
          renderer.dispose();
        }
      }
      const report = { part, result };
      log.info("GPU check", JSON.stringify(report));
      notify("info", `GPU check: ${part} done`);
      return textResult(report);
    } catch (error) {
      return errorResult(toAppError(error));
    }
  },
});
