import { useCurrentEntry } from "./current.hook";

/** What the grade panel says when there is no grade to edit at this level. */
export function NoSubject() {
  const entry = useCurrentEntry();
  return (
    <div className="px-3 py-4 text-sm text-muted-foreground">
      {entry
        ? "This clip is in no shot group. Select clips in the strip and make one with Make shot group."
        : "Pick a clip with a picture to grade it."}
    </div>
  );
}
