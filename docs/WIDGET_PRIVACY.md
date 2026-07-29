# Widget privacy

Widgets are opt-in. Desktop defaults to disabled and content-hidden privacy. Android defaults to hidden insight privacy for every new widget.

Privacy modes are hidden, redacted saved insight, and full saved insight. Redaction shows only a short first sentence. AI insight mode is display-only and only consumes an already-persisted successful analysis for the same profile and day. It never includes provider credentials, hidden reasoning, raw prompts, source logs, or tokens.

The desktop snapshot contains a current activity summary but not private log history. Android’s native provider only receives a reduced Flutter-written snapshot in app-private preferences; it does not open the encrypted Drift database. A profile mismatch is rendered as unavailable rather than falling back to another profile.
