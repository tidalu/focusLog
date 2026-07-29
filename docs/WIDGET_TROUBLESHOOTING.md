# Widget troubleshooting

If Android says it needs a local profile, open FocusLog once so the app can unlock its encrypted local database and publish a fresh snapshot, then reconfigure the widget. If a profile was deleted or paired to a different owner, remove or reconfigure that widget.

Widgets continue showing the last available local snapshot offline. A pending-sync marker is informational; a local quick-entry save has already succeeded. Open the app and use Sync if a backend connection remains unavailable.

Android launchers can defer redraws under battery restrictions. FocusLog refreshes on relevant foreground changes and uses a six-hour fallback; it does not consume battery with a continuous timer. For desktop, use Settings → FocusLog widget or the tray’s Show widget item if it was hidden. A disconnected monitor is recovered to the primary display on the next widget launch.

No widget insight means there is no eligible persisted insight, insight privacy is hidden, or the current mobile implementation has no AI-memory store. Widgets intentionally never generate analysis on demand.
