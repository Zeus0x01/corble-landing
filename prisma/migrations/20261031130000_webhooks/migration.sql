CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('RECEIVED', 'FAILED', 'DUPLICATE');

CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "secretHash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "fileAssetId" TEXT,
    "filename" TEXT,
    "size" INTEGER,
    "status" "WebhookDeliveryStatus" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FileAsset" ADD COLUMN "webhookId" TEXT;
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_secretHash_key" UNIQUE ("secretHash");
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "WebhookDelivery_webhookId_idempotencyKey_key" ON "WebhookDelivery"("webhookId", "idempotencyKey");
CREATE INDEX "Webhook_ownerId_idx" ON "Webhook"("ownerId");
CREATE INDEX "Webhook_enabled_idx" ON "Webhook"("enabled");
CREATE INDEX "WebhookDelivery_webhookId_receivedAt_idx" ON "WebhookDelivery"("webhookId", "receivedAt");
CREATE INDEX "FileAsset_webhookId_idx" ON "FileAsset"("webhookId");
