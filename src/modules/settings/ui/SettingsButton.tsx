import { Settings } from "lucide-react";
import { useKernel } from "@/core";
import { IconButton } from "@/ui";
import { openSettings } from "../settings.commands";

/** The gear in the top bar that opens Settings. */
export function SettingsButton() {
  const { bus } = useKernel();
  return (
    <IconButton label="Settings (Ctrl+,)" onClick={() => void bus.run(openSettings, {})}>
      <Settings />
    </IconButton>
  );
}
