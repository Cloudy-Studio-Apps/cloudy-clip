/** Decodes a capture (a data URL, or bare base64 PNG) into its pixels. */
export async function pixelsOf(data: string): Promise<ImageData> {
  const url = data.startsWith("data:") ? data : `data:image/png;base64,${data}`;
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2D canvas to read the frame with");
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
