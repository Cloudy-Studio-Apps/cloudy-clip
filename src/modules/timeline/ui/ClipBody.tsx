import type { TrackKind } from "@/modules/project";
import { Waveform } from "@/ui";

interface ClipBodyProps {
  kind: TrackKind;
  /** Poster frame of the clip's media, repeated as a filmstrip. */
  poster: string | undefined;
}

/** The picture under a clip's name: a filmstrip for video, a waveform for audio. */
export function ClipBody({ kind, poster }: ClipBodyProps) {
  if (kind === "audio") {
    return (
      <Waveform tileWidth={120} className="absolute inset-x-0 bottom-1 top-[21px] text-white/60" />
    );
  }
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 top-[17px] bg-repeat-x"
      style={{
        backgroundImage: [
          // Frame separators every 64px.
          "repeating-linear-gradient(90deg, transparent 0 63px, oklch(0 0 0 / 0.45) 63px 64px)",
          poster ? `url(${poster})` : "",
        ]
          .filter(Boolean)
          .join(", "),
        backgroundSize: poster ? "64px 100%, auto 100%" : "64px 100%",
      }}
    />
  );
}
