# Android home-screen widget

FocusLog uses a native Android `AppWidgetProvider` and RemoteViews rather than Glance because this Flutter application has no compatible Android Compose/Glance layer. The widget offers genuinely different small, medium, and large layouts, and its per-instance configuration stores mode, privacy choice, and profile ID.

Small shows completion and Add log. Medium adds logs, focus state, and reminder information. Large can show a saved insight only when privacy is explicitly enabled. The current mobile persistence schema has no AI-memory table, so it safely reports that no saved insight exists; it never generates one.

`Add log` opens the focused Flutter quick-entry destination. It supports the existing `<category>` syntax, validates a non-empty log, writes through `FocusLogRepository.createCheckIn`, refreshes the widget, then requests normal sync asynchronously. The device remains usable offline.

Snapshots update on app startup/resume, local log creation, focus session changes, and foreground synchronization. Android also redraws after date/timezone broadcasts and has a six-hour fallback interval. Active timers display the last snapshot rather than attempting an inefficient second-by-second widget countdown.

Android lock-screen visibility varies by launcher and system version; FocusLog’s widget privacy setting controls sensitive content but cannot override a launcher’s own lock-screen policy.
