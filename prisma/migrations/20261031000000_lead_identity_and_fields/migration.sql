-- Add stable, human-readable lead references. The temporary nullable columns allow
-- existing rows to be backfilled before the uniqueness and NOT NULL constraints.
ALTER TABLE "Lead" ADD COLUMN "leadCode" TEXT;
ALTER TABLE "IncomingLead" ADD COLUMN "leadCode" TEXT;

ALTER TABLE "Lead"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "website" TEXT,
  ADD COLUMN "industry" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "country" TEXT;

ALTER TABLE "IncomingLead"
  ADD COLUMN "city" TEXT,
  ADD COLUMN "country" TEXT;

ALTER TABLE "Task" ADD COLUMN "leadId" TEXT;

CREATE TABLE "LeadIdSequence" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "nextValue" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadIdSequence_pkey" PRIMARY KEY ("id")
);

WITH numbered AS (
  SELECT kind, id, ROW_NUMBER() OVER (ORDER BY kind, id) AS n
  FROM (
    SELECT 'final' AS kind, "id" FROM "Lead"
    UNION ALL
    SELECT 'incoming' AS kind, "id" FROM "IncomingLead"
  ) records
)
UPDATE "Lead" l
SET "leadCode" = 'LEAD-' || LPAD(numbered.n::text, 6, '0')
FROM numbered
WHERE numbered.kind = 'final' AND numbered.id = l."id";

WITH numbered AS (
  SELECT kind, id, ROW_NUMBER() OVER (ORDER BY kind, id) AS n
  FROM (
    SELECT 'final' AS kind, "id" FROM "Lead"
    UNION ALL
    SELECT 'incoming' AS kind, "id" FROM "IncomingLead"
  ) records
)
UPDATE "IncomingLead" l
SET "leadCode" = 'LEAD-' || LPAD(numbered.n::text, 6, '0')
FROM numbered
WHERE numbered.kind = 'incoming' AND numbered.id = l."id";

INSERT INTO "LeadIdSequence" ("id", "nextValue")
SELECT 1, COUNT(*) + 1 FROM (
  SELECT "id" FROM "Lead"
  UNION ALL
  SELECT "id" FROM "IncomingLead"
) records;

ALTER TABLE "Lead" ALTER COLUMN "leadCode" SET NOT NULL;
ALTER TABLE "IncomingLead" ALTER COLUMN "leadCode" SET NOT NULL;

CREATE UNIQUE INDEX "Lead_leadCode_key" ON "Lead"("leadCode");
CREATE UNIQUE INDEX "IncomingLead_leadCode_key" ON "IncomingLead"("leadCode");
CREATE INDEX "Task_leadId_idx" ON "Task"("leadId");

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
