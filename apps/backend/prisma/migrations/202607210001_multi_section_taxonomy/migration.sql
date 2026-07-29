ALTER TABLE "categories" ADD COLUMN "parentId" VARCHAR(26);
ALTER TABLE "categories" ADD COLUMN "path" VARCHAR(500);
ALTER TABLE "categories" ADD COLUMN "depth" INTEGER NOT NULL DEFAULT 1;

WITH category_map AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY "ownerId", LOWER(TRIM(name)) ORDER BY "createdAt", id
         ) AS canonical_id
  FROM "categories"
)
UPDATE "check_ins" check_in
SET "categoryId" = category_map.canonical_id
FROM category_map
WHERE check_in."categoryId" = category_map.id
  AND category_map.id <> category_map.canonical_id;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "ownerId", LOWER(TRIM(name)) ORDER BY "createdAt", id
         ) AS duplicate_number
  FROM "categories"
)
DELETE FROM "categories"
WHERE id IN (SELECT id FROM ranked WHERE duplicate_number > 1);

UPDATE "categories" SET "path" = LOWER(TRIM("name"));
ALTER TABLE "categories" ALTER COLUMN "path" SET NOT NULL;
ALTER TABLE "categories" DROP CONSTRAINT "categories_ownerId_name_key";
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "categories_ownerId_path_key" ON "categories"("ownerId", "path");
CREATE INDEX "categories_ownerId_parentId_deletedAt_idx"
  ON "categories"("ownerId", "parentId", "deletedAt");

CREATE TABLE "log_sections" (
  "id" VARCHAR(26) PRIMARY KEY,
  "ownerId" VARCHAR(26) NOT NULL REFERENCES "owners"("id") ON DELETE RESTRICT,
  "checkInId" VARCHAR(26) NOT NULL REFERENCES "check_ins"("id") ON DELETE RESTRICT,
  "revisionId" VARCHAR(26) NOT NULL REFERENCES "check_in_revisions"("id") ON DELETE RESTRICT,
  "categoryId" VARCHAR(26) REFERENCES "categories"("id") ON DELETE SET NULL,
  "position" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "timezoneId" VARCHAR(64) NOT NULL,
  "version" VARCHAR(26) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("revisionId", "position")
);

INSERT INTO "log_sections"
  ("id", "ownerId", "checkInId", "revisionId", "categoryId", "position", "body",
   "metadata", "occurredAt", "timezoneId", "version", "createdAt")
SELECT r."id", c."ownerId", c."id", r."id", c."categoryId", 0, r."body", '{}'::jsonb,
       c."submittedAt", c."timezoneId", r."id", r."createdAt"
FROM "check_in_revisions" r
JOIN "check_ins" c ON c."id" = r."checkInId";

CREATE INDEX "log_sections_checkInId_revisionId_position_idx"
  ON "log_sections"("checkInId", "revisionId", "position");
CREATE INDEX "log_sections_ownerId_occurredAt_idx"
  ON "log_sections"("ownerId", "occurredAt");
CREATE INDEX "log_sections_categoryId_occurredAt_idx"
  ON "log_sections"("categoryId", "occurredAt");
CREATE INDEX "log_sections_search_idx"
  ON "log_sections" USING GIN (to_tsvector('simple', "body"));
