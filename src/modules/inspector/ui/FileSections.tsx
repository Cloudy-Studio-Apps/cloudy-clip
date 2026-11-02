import { FileFactsSection, MetadataSection } from "@/modules/media";
import type { InspectorContext } from "../inspector.types";

/** What the clip's file is. */
export function FileSection({ context }: { context: InspectorContext }) {
  const { mediaId } = context.clip;
  return mediaId === undefined ? null : <FileFactsSection mediaId={mediaId} />;
}

/** What's noted about the clip's file, shared by all its clips. */
export function FileMetadataSection({ context }: { context: InspectorContext }) {
  const { mediaId } = context.clip;
  return mediaId === undefined ? null : <MetadataSection mediaId={mediaId} />;
}
