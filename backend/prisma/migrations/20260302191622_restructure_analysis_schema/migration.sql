/*
  Warnings:

  - You are about to drop the column `userId` on the `analyses` table. All the data in the column will be lost.
  - The `mainProblem` column on the `analyses` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[conversationId]` on the table `analyses` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "analyses" DROP CONSTRAINT "analyses_userId_fkey";

-- DropIndex
DROP INDEX "analyses_conversationId_userId_idx";

-- DropIndex
DROP INDEX "analyses_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "analyses" DROP COLUMN "userId",
ADD COLUMN     "agentConduct" JSONB,
ADD COLUMN     "handoffs" JSONB,
ADD COLUMN     "keyEvidences" JSONB,
DROP COLUMN "mainProblem",
ADD COLUMN     "mainProblem" JSONB;

-- CreateTable
CREATE TABLE "analysis_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analysis_history_userId_viewedAt_idx" ON "analysis_history"("userId", "viewedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "analysis_history_userId_analysisId_key" ON "analysis_history"("userId", "analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "analyses_conversationId_key" ON "analyses"("conversationId");

-- CreateIndex
CREATE INDEX "analyses_conversationId_idx" ON "analyses"("conversationId");

-- AddForeignKey
ALTER TABLE "analysis_history" ADD CONSTRAINT "analysis_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_history" ADD CONSTRAINT "analysis_history_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
