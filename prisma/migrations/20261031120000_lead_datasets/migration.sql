CREATE TABLE "LeadDataset" (
    "id" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadDataset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadWorkspaceState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeDatasetId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadWorkspaceState_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Lead" ADD COLUMN "datasetId" TEXT;
ALTER TABLE "LeadDataset" ADD CONSTRAINT "LeadDataset_fileAssetId_key" UNIQUE ("fileAssetId");
ALTER TABLE "LeadWorkspaceState" ADD CONSTRAINT "LeadWorkspaceState_userId_key" UNIQUE ("userId");
CREATE INDEX "LeadDataset_ownerId_idx" ON "LeadDataset"("ownerId");
CREATE INDEX "Lead_datasetId_idx" ON "Lead"("datasetId");
ALTER TABLE "LeadDataset" ADD CONSTRAINT "LeadDataset_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadDataset" ADD CONSTRAINT "LeadDataset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadWorkspaceState" ADD CONSTRAINT "LeadWorkspaceState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadWorkspaceState" ADD CONSTRAINT "LeadWorkspaceState_activeDatasetId_fkey" FOREIGN KEY ("activeDatasetId") REFERENCES "LeadDataset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "LeadDataset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
