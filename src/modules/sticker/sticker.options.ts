import { z } from "zod";
import { definePropType } from "@/modules/element";

/** The `sticker-variation` prop type: the chosen option of each of a sticker's axes. */
export const stickerVariationType = definePropType({
  name: "sticker-variation",
  control: "sticker-variation",
  schema: () => z.record(z.string(), z.string()),
});
