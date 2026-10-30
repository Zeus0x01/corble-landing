ALTER TABLE "GitHubConnection"
  ADD COLUMN "latestCommitMessage" TEXT,
  ADD COLUMN "latestCommitUrl" TEXT,
  ADD COLUMN "latestCommitAt" TIMESTAMP(3),
  ADD COLUMN "framework" TEXT,
  ADD COLUMN "webhookId" TEXT,
  ADD COLUMN "webhookSecret" TEXT;
