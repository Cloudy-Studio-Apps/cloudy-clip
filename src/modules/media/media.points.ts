import { definePoint } from "@/core";
import type { LibrarySection } from "./media.types";

/** Sections of the Library, above the files. The media library reads them. */
export const librarySections = definePoint<LibrarySection>("media.librarySections", {
  keyOf: (section) => section.id,
});
