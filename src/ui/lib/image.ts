/**
 * Shrinks a picture to `width` pixels wide (the height keeps its shape) as a JPEG data URL.
 * Takes a data URL or a bare base64 PNG, as the preview's captures give.
 */
export async function shrinkDataUrl(
  source: string,
  width: number,
  quality = 0.75,
): Promise<string> {
  const image = new Image();
  image.src = source.startsWith("data:") ? source : `data:image/png;base64,${source}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round((width * image.naturalHeight) / image.naturalWidth);
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}
