import { DEMO_FRAME } from "./demo/demo.images";

/** The picture as it is after a layer (a demo stand-in). */
export function LayerThumb({ look, dim }: { look: string; dim?: boolean }) {
  return (
    <span className="block h-9 w-16 shrink-0 overflow-hidden rounded-xs bg-stage">
      <img
        src={DEMO_FRAME}
        alt=""
        draggable={false}
        className="size-full object-cover"
        style={{ filter: look, opacity: dim ? 0.45 : 1 }}
      />
    </span>
  );
}
