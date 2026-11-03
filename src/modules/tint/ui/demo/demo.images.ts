import city from "./demo.city.jpg";
import highway from "./demo.highway.jpg";
import meadow from "./demo.meadow.jpg";
import plane from "./demo.plane.jpg";
import plaza from "./demo.plaza.jpg";
import tractor from "./demo.tractor.jpg";
import wheat from "./demo.wheat.jpg";

/** The demo's pictures, by name. */
export const DEMO_IMAGES = { city, highway, meadow, plane, plaza, tractor, wheat } as const;

/** The picture being graded in the demo. */
export const DEMO_FRAME = plaza;

/** CSS filter standing in for the demo grade on the viewer. */
export const DEMO_GRADED = "brightness(1.04) contrast(1.12) saturate(1.08) sepia(0.12)";
