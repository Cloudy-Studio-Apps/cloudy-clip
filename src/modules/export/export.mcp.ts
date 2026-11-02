import { z } from "zod";
import { commandTool, defineMcpTool, textResult } from "@/core";
import { cancel, clearFinished, enqueue, moveUp, remove, start } from "./export.commands";
import { exportRef } from "./export.ref";
import { readCapabilities } from "./export.service";

/** Says what's in the queue, without the document each job keeps. */
const getQueue = defineMcpTool({
  name: "export_get_queue",
  readOnly: true,
  description:
    "Lists exports, oldest first: jobId, file, path, status (waiting, preparing, rendering, finishing, done, failed, cancelled), progress 0..1 of that status, and why one failed.",
  input: z.object({}),
  handler(_input, ctx) {
    const { jobs } = ctx.require(exportRef).queue.getState();
    return textResult(
      jobs.map(({ id, file, path, status, progress, message, estimatedBytes }) => ({
        jobId: id,
        file,
        path,
        status,
        progress,
        message,
        estimatedBytes,
      })),
    );
  },
});

/** Says what this computer can export. */
const getCapabilities = defineMcpTool({
  name: "export_capabilities",
  readOnly: true,
  description:
    "Says whether FFmpeg is installed, which formats it can write, and which graphics card encoders work.",
  input: z.object({}),
  async handler() {
    return textResult(await readCapabilities());
  },
});

/** Agents export like the Export page does. */
export const exportMcpTools = [
  commandTool(enqueue, { name: "export_enqueue", writes: true }),
  commandTool(start, { name: "export_start", writes: true }),
  commandTool(cancel, { name: "export_cancel", writes: true }),
  commandTool(remove, { name: "export_remove", writes: true }),
  commandTool(moveUp, { name: "export_move_up", writes: true }),
  commandTool(clearFinished, { name: "export_clear_finished", writes: true }),
  getQueue,
  getCapabilities,
];
