import { describe, expect, it, vi } from "vitest";
import { createLogger } from "@/core";
import { seedProject } from "@/modules/project";
import { createExportRunner } from "./export.runner";
import { beginExport } from "./export.service";
import { createQueueStore } from "./export.store";
import type { ExportJob, LoudnessMatcher, RunnerDeps } from "./export.types";

// The native side isn't here: the export starts and finishes at once.
vi.mock("./export.service", () => ({
  beginExport: vi.fn(() => Promise.resolve({ jobId: "native", frameUrl: "" })),
  finishExport: vi.fn(() => Promise.resolve("/out/song.wav")),
  cancelExport: vi.fn(() => Promise.resolve()),
  revealFile: vi.fn(),
  sendFrame: vi.fn(),
}));

describe("match target on export", () => {
  it("corrects the job's own spec, leaving the project and the queued spec as they were", async () => {
    const project = seedProject();
    const before = structuredClone(project);
    const queue = createQueueStore();
    const job: ExportJob = {
      id: "e1",
      file: "song.wav",
      path: "/out/song.wav",
      kindLabel: "Default",
      compositionId: "c1",
      status: "waiting",
      progress: 0,
      estimatedBytes: 0,
      reveal: false,
      range: { start: 0, duration: 1_000_000 },
      project,
      matchTarget: true,
      spec: {
        output: "/out/song.wav",
        format: "wav",
        width: 1080,
        height: 1920,
        fps: 30,
        duration: 1_000_000,
        crf: 23,
        audioKbps: 192,
        sampleRate: 48000,
        effort: "balanced",
        hardware: false,
        sound: [
          { path: "/a.wav", at: 0, from: 0, duration: 1_000_000, track: 0, fadeIn: 0, fadeOut: 0 },
        ],
        mix: { tracks: [{ gain: 1, pan: 0 }], buses: [], master: { gain: 1 } },
      },
    };
    queue.setState({ jobs: [job] });
    const statuses: string[] = [];
    queue.subscribe(({ jobs }) => statuses.push(jobs[0]!.status));
    const matcher: LoudnessMatcher = {
      id: "test",
      match: ({ onProgress }) => {
        onProgress(1);
        return Promise.resolve({ gainDb: 4, limiter: { ceilingDb: -1, releaseMs: 50 } });
      },
    };
    const runner = createExportRunner({
      queue,
      preview: {} as RunnerDeps["preview"],
      media: {} as RunnerDeps["media"],
      log: createLogger("test"),
      matcher: () => matcher,
    });
    runner.start();
    await vi.waitFor(() => expect(queue.getState().jobs[0]!.status).toBe("done"));

    expect(statuses).toContain("measuring");
    expect(vi.mocked(beginExport).mock.calls[0]![0].mix.master).toEqual({
      gain: 1,
      correction: { gainDb: 4, limiter: { ceilingDb: -1, releaseMs: 50 } },
    });
    const done = queue.getState().jobs[0]!;
    expect(done.project).toBe(project);
    expect(project).toEqual(before);
    expect(done.spec.mix.master).toEqual({ gain: 1 });
  });
});
