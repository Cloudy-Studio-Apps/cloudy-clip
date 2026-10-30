import { svgDataUrl } from "../../logic/svg";
import { defineStickerPack } from "../../sticker.points";
import type { SealFace, StickerDefinition } from "../../sticker.types";
import { sealSvg } from "./seal.face";
import { SEAL_EYES as EYES, SEAL_MOUTHS as MOUTHS } from "./seal.parts";
import { SEAL_PROPS as PROPS } from "./seal.props";

const ANIMATIONS = import.meta.glob<string>("./anim/*.json", {
  eager: true,
  query: "?url",
  import: "default",
});
const STILLS = import.meta.glob<string>("./anim/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

/** A moving seal, as a Lottie file made by `scripts/stickers.seals.mjs`. */
function moving(
  name: string,
  label: string,
  keywords: string[],
  aspect: number,
): StickerDefinition {
  const url = ANIMATIONS[`./anim/${name}.json`] ?? "";
  return {
    id: name,
    label,
    keywords: ["seal", "foca", "animated", ...keywords],
    topics: ["reactions"],
    aspect,
    thumbnail: STILLS[`./anim/${name}.svg`],
    art: () => ({ type: "lottie", url }),
  };
}

function seal(name: string, label: string, keywords: string[], face: SealFace): StickerDefinition {
  const url = svgDataUrl(sealSvg(face));
  return {
    id: name,
    label,
    keywords: ["seal", "foca", ...keywords],
    topics: ["reactions"],
    art: () => ({ type: "image", url }),
  };
}

/** The "foca watona" (spotted seal) stickers, one per mood. */
const SEAL_STICKERS: readonly StickerDefinition[] = [
  seal("happy", "Happy", ["smile", "content", "calm"], { eyes: EYES.happy }),
  seal("love", "Love", ["heart", "like", "cute"], {
    eyes: EYES.happy,
    mouth: MOUTHS.smile,
    front: PROPS.hearts,
    blush: 1,
  }),
  seal("laughing", "Laughing", ["lol", "funny", "haha"], {
    eyes: EYES.squeezed,
    mouth: MOUTHS.open,
    front: PROPS.laughTears,
  }),
  seal("wink", "Wink", ["playful", "tongue", "joke"], {
    eyes: EYES.wink,
    mouth: MOUTHS.tongue,
    front: PROPS.winkSparkle,
  }),
  seal("cool", "Cool", ["sunglasses", "nice", "chill"], {
    eyes: "",
    mouth: MOUTHS.smirk,
    front: PROPS.sunglasses,
  }),
  seal("party", "Party", ["celebrate", "birthday", "launch"], {
    eyes: EYES.happy,
    mouth: MOUTHS.open,
    front: PROPS.partyHat + PROPS.confetti,
  }),
  seal("yay", "Yay", ["celebrate", "cheer", "win"], {
    eyes: EYES.happy,
    mouth: MOUTHS.open,
    back: PROPS.raisedFlippers,
    front: PROPS.yaySparkles,
  }),
  seal("approve", "Approve", ["ok", "yes", "agree", "thumbs up"], {
    eyes: EYES.open,
    mouth: MOUTHS.smile,
    front: PROPS.approveFlipper,
  }),
  seal("surprised", "Surprised", ["wow", "shock", "omg"], {
    eyes: EYES.big,
    mouth: MOUTHS.oh,
    front: PROPS.exclamation,
  }),
  seal("thinking", "Thinking", ["hmm", "idea", "question", "wonder"], {
    eyes: EYES.lookingUp,
    mouth: MOUTHS.smirk,
    front: PROPS.thoughtBubbles,
  }),
  seal("nervous", "Nervous", ["sweat", "oops", "awkward"], {
    eyes: EYES.sad,
    mouth: MOUTHS.wobbly,
    front: PROPS.sweat,
  }),
  seal("sleepy", "Sleepy", ["tired", "sleep", "zzz", "bored"], {
    eyes: EYES.sleepy,
    front: PROPS.zzz,
    blush: 0.5,
  }),
  seal("sad", "Sad", ["unhappy", "down", "disappointed"], {
    eyes: EYES.sad,
    mouth: MOUTHS.frown,
    blush: 0.4,
  }),
  seal("crying", "Crying", ["tears", "sob", "cry"], {
    eyes: EYES.crying,
    mouth: MOUTHS.wobbly,
    front: PROPS.tearStreams,
  }),
  seal("angry", "Angry", ["mad", "grumpy", "annoyed"], {
    eyes: EYES.angry,
    mouth: MOUTHS.frown,
    front: PROPS.angerMark,
    blush: 1,
  }),
];

/** Cloudy Seal: the "foca watona" mascot from Cloudy Canvas. */
export const sealPack = defineStickerPack({
  id: "seal",
  name: "Cloudy Seal",
  order: 10,
  stickers: [
    moving("hopping", "Hopping", ["jump", "bounce", "waiting"], 80 / 76),
    moving("celebrating", "Celebrating", ["party", "wave", "cheer"], 80 / 76),
    moving("patting", "Patting", ["belly", "drum", "full"], 1),
    moving("painting", "Painting", ["art", "brush", "palette"], 100 / 68),
    moving("adrift", "Adrift", ["dizzy", "lost", "error", "ice"], 224 / 170),
    ...SEAL_STICKERS,
  ],
});
