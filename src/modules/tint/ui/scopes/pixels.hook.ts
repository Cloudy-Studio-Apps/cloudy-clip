import { useEffect, useState } from "react";
import { DEMO_FRAME } from "../demo/demo.images";

/** Size the demo frame is read at for the scopes. */
const WIDTH = 180;
const HEIGHT = 100;

/** The demo frame's pixels, read once at a small size. */
export function useDemoPixels(): ImageData | null {
  const [pixels, setPixels] = useState<ImageData | null>(null);
  useEffect(() => {
    let live = true;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx || !live) return;
      ctx.filter = "contrast(1.12) saturate(1.08) sepia(0.12)";
      ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
      setPixels(ctx.getImageData(0, 0, WIDTH, HEIGHT));
    };
    image.src = DEMO_FRAME;
    return () => {
      live = false;
    };
  }, []);
  return pixels;
}
