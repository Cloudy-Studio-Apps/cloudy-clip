import { AudioLines, Film } from "lucide-react";
import { defineElement } from "@/modules/element";

/**
 * A piece of an imported file on the timeline: a picture on a video track (fitted in the frame,
 * placed with the transform tools) or sound on an audio track. Decoded by the preview engine.
 */
export const mediaElement = defineElement({
  kind: "media",
  name: "Media",
  source: "media",
  tracks: ["video", "audio"],
  supports: { transform: true },
  properties: {},
  defaults: () => ({}),
  display(clip, { project, track }) {
    const video = track?.kind !== "audio";
    const name = clip.mediaId ? project.media[clip.mediaId]?.name : undefined;
    return {
      icon: video ? Film : AudioLines,
      color: video ? "clip-video" : "clip-audio",
      label: name ?? "Missing media",
      body: video ? "poster" : "waveform",
    };
  },
  picture: { fit: "contain", source: "media" },
});
