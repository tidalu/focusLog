# Windows desktop widget

The desktop widget is a compact frameless Electron overlay window. It is not a Microsoft Windows Widgets-panel provider. It is hidden or shown from the system tray and configured from FocusLog Settings.

The window can be dragged, resized, optionally kept always-on-top, and remembers its size and location in the existing owner settings. On launch, coordinates are clamped to the primary display work area, so a disconnected display cannot leave it unrecoverable. It is DPI-aware through Electron’s normal window handling.

The overlay has no direct database access. A context-isolated preload exposes only allowlisted widget snapshot, quick-add, show/hide, and settings IPC calls. Widget text is inserted with `textContent`; navigation is limited to data URLs with the existing secured web preferences. The quick-entry window calls the same `createOfflineCheckIn` application path, refreshes immediately, and asks existing synchronization to run.

The tray provides Open FocusLog, Show/Hide widget, Quick add log, Start/stop focus via the main application command, and Quit. Updates are event-driven after local widget writes and sync completion; the renderer has only a one-minute display refresh fallback.
