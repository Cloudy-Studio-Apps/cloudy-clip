import type { ReactNode } from "react";
import type { ClipId } from "@/modules/project";
import { useClipContext } from "./clip.context.hook";
import { ClipTabBody } from "./ClipTabBody";

interface ClipTabProps {
  clipId: ClipId;
  tab: string;
  /** Shown when the clip has nothing in that tab. */
  empty: ReactNode;
}

/** One tab of a clip by id, with its track and linked partner; nothing once the clip is gone. */
export function ClipTab({ clipId, tab, empty }: ClipTabProps) {
  const context = useClipContext(clipId);
  if (!context) return null;
  return <ClipTabBody context={context} tab={tab} empty={empty} />;
}
