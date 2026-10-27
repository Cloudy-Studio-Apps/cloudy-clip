import { Button, EmptyState } from "@/ui";
import { usePickMedia } from "./media.pick.hook";

/** Shown while the project has no media. */
export function MediaEmpty() {
  const pickMedia = usePickMedia();
  return (
    <EmptyState
      title="Nothing here yet"
      action={
        <Button variant="primary" onClick={() => void pickMedia()}>
          Import media
        </Button>
      }
    >
      Drop videos or music here,
      <br />
      or import them from your computer.
    </EmptyState>
  );
}
