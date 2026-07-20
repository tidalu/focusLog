ALTER TABLE "check_in_revisions"
ADD COLUMN "searchDocument" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce("body", '')), 'A')
) STORED;

CREATE INDEX "check_in_revisions_search_document_idx"
ON "check_in_revisions" USING GIN ("searchDocument");

CREATE INDEX "check_in_tags_tagId_checkInId_idx"
ON "check_in_tags" ("tagId", "checkInId");

CREATE INDEX "check_ins_ownerId_categoryId_focusSessionId_submittedAt_idx"
ON "check_ins" ("ownerId", "categoryId", "focusSessionId", "submittedAt" DESC);
