import { definePoint } from "@/core";
import type { LibraryKind, LibrarySection } from "./media.types";

/** Sections of the Library, above the files. The media library reads them. */
export const librarySections = definePoint<LibrarySection>("media.librarySections", {
  keyOf: (section) => section.id,
});

/** Kinds of item the library lists besides files. The media library reads them. */
export const libraryKinds = definePoint<LibraryKind>("media.libraryKinds", {
  keyOf: (kind) => kind.type,
});
