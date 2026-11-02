import type { ElementDisplay } from "@/modules/element";
import { Waveform } from "@/ui";

interface ClipBodyProps {
  /** What the clip's element shows under its name. */
  body: ElementDisplay["body"];
  /** Poster frame of the clip's media, repeated as a filmstrip. */
  poster: string | undefined;
}

/** The picture under a clip's name: a filmstrip, a waveform, or nothing (text). */
export function ClipBody({ body, poster }: ClipBodyProps) {
  if (body === "none") return null;
  if (body === "waveform") {
    return (
      <Waveform
        tileWidth={120}
        className="absolute inset-x-0 bottom-1 top-[20px] text-muted-foreground"
      />
    );
  }
  return (
    <div
      className="pointer-events-none absolute inset-0 bg-repeat-x"
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
