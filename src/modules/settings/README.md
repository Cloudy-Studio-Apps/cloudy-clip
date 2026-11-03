# settings

The Settings window, for choices that belong to the user and the machine, not to a project. It opens from the gear in the top bar, the logo menu (Settings, next to File) or `Ctrl+,`, as a window, so the edit stays as it was. It knows nothing about what it holds: each section comes from another module.

- **Tier:** feature
- **Requires:** nothing
- **Contributes:** overlay `settings.dialog`, top bar item `settings.button` (the gear, right), keybinding `settings.open`, and menu item `settings.open` at the menu's own level
- **API:** `store` (`{ open }`), `close()`
- **Points it reads:** `settingsSections` (`{ id, label, order, component }`). Plugins add sections here. The list of sections shows once there are two.
- **Commands:** `settings.open`, not undoable. It has no MCP tool: it would act on the user's screen.
- **Files:** `settings.points.ts`, `settings.store.ts`, `settings.commands.ts`, `ui/SettingsDialog.tsx`, `ui/SettingsButton.tsx`.
