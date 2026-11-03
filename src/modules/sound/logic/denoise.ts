import type { DenoiseRequest } from "@/modules/media";
import type { DenoiseNeed, MediaId } from "@/modules/project";

/**
 * The renderings `needs` call for, for the files that have sound; once each. Every need wants the
 * forward rendering, which export mixes from (reversing it itself); a reversed clip wants the
 * reversed copy too, which the preview plays. The forward one comes first: the copy is made from it.
 */
export function denoiseRequests(
  needs: readonly DenoiseNeed[],
  hasSound: (id: MediaId) => boolean,
): DenoiseRequest[] {
  const requests = new Map<string, DenoiseRequest>();
  const want = (request: DenoiseRequest) => {
    const { mediaId, amountDb, floorDb, reversed } = request;
    requests.set(`${mediaId}|${amountDb}|${floorDb}|${reversed}`, request);
  };
  for (const { mediaId, denoise, reversed } of needs) {
    if (!hasSound(mediaId)) continue;
    const { amountDb, floorDb } = denoise;
    want({ mediaId, amountDb, floorDb, reversed: false });
    if (reversed) want({ mediaId, amountDb, floorDb, reversed: true });
  }
  // Forward ones first, so a reversed copy finds its file made.
  return [...requests.values()].sort((a, b) => Number(a.reversed) - Number(b.reversed));
}
