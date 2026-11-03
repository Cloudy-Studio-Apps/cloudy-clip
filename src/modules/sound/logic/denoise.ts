import type { DenoiseRequest } from "@/modules/media";
import type { DenoiseNeed, MediaId } from "@/modules/project";

/** The renderings `needs` call for, for the files that have sound; once each. */
export function denoiseRequests(
  needs: readonly DenoiseNeed[],
  hasSound: (id: MediaId) => boolean,
): DenoiseRequest[] {
  const requests = new Map<string, DenoiseRequest>();
  for (const { mediaId, denoise, reversed } of needs) {
    if (!hasSound(mediaId)) continue;
    const { amountDb, floorDb } = denoise;
    requests.set(`${mediaId}|${amountDb}|${floorDb}|${reversed}`, {
      mediaId,
      amountDb,
      floorDb,
      reversed,
    });
  }
  return [...requests.values()];
}
