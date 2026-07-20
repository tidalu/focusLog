CREATE INDEX "focus_sessions_ownerId_startedAt_endedAt_idx"
  ON "focus_sessions"("ownerId", "startedAt", "endedAt");

CREATE INDEX "reminder_occurrences_ownerId_resolvedAt_idx"
  ON "reminder_occurrences"("ownerId", "resolvedAt");
