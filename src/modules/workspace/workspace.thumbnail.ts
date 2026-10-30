const WIDTH = 240;

/** Shrinks a base64 PNG to a small JPEG data URL for the recent list. */
export async function shrinkFrame(png: string): Promise<string> {
  const image = new Image();
  image.src = `data:image/png;base64,${png}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = Math.round((WIDTH * image.naturalHeight) / image.naturalWidth);
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.75);
}
