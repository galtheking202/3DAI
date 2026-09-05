-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "nextPollAt" TIMESTAMP(3),
ADD COLUMN     "progress" INTEGER,
ADD COLUMN     "providerRef" TEXT;

-- CreateIndex
CREATE INDEX "Job_status_nextPollAt_idx" ON "Job"("status", "nextPollAt");
