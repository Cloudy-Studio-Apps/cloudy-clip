/** The picture after a layer, once drawn; a plain block until then (or when it can't be drawn). */
export function LayerThumb({ src, dim }: { src?: string; dim?: boolean }) {
  return (
    <span className="block h-9 w-16 shrink-0 overflow-hidden rounded-xs bg-stage">
      {src && (
        <img
          src={src}
          alt=""
          draggable={false}
          className="size-full object-cover"
          style={{ opacity: dim ? 0.45 : 1 }}
        />
      )}
    </span>
  );
}
