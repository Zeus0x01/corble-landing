-- CreateEnum
CREATE TYPE "FileLinkKind" AS ENUM ('LEAD', 'INCOMING');

-- CreateTable
CREATE TABLE "FileLeadLink" (
    "id" TEXT NOT NULL,
    "kind" "FileLinkKind" NOT NULL,
    "leadId" TEXT,
    "incomingLeadId" TEXT,
    "fileAssetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileLeadLink_pkey" PRIMARY KEY ("id")
);

-- Migrate existing lead attachments into FileLeadLink
INSERT INTO "FileLeadLink" ("id", "kind", "leadId", "fileAssetId", "createdAt")
SELECT gen_random_uuid()::text, 'LEAD', f."leadId", f."id", f."updatedAt"
FROM "FileAsset" f
WHERE f."leadId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "FileLeadLink_fileAssetId_idx" ON "FileLeadLink"("fileAssetId");

-- CreateIndex
CREATE INDEX "FileLeadLink_leadId_idx" ON "FileLeadLink"("leadId");

-- CreateIndex
CREATE INDEX "FileLeadLink_incomingLeadId_idx" ON "FileLeadLink"("incomingLeadId");

-- AddForeignKey
ALTER TABLE "FileLeadLink" ADD CONSTRAINT "FileLeadLink_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileLeadLink" ADD CONSTRAINT "FileLeadLink_incomingLeadId_fkey" FOREIGN KEY ("incomingLeadId") REFERENCES "IncomingLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileLeadLink" ADD CONSTRAINT "FileLeadLink_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "FileAsset" DROP CONSTRAINT "FileAsset_leadId_fkey";

-- DropIndex
DROP INDEX "FileAsset_leadId_idx";

-- AlterTable
ALTER TABLE "FileAsset" DROP COLUMN "leadId";
