/*
  Warnings:

  - You are about to drop the column `agentScores` on the `analyses` table. All the data in the column will be lost.
  - You are about to drop the column `classification` on the `analyses` table. All the data in the column will be lost.
  - You are about to drop the column `totalScore` on the `analyses` table. All the data in the column will be lost.
  - You are about to drop the `analysis_jobs` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[supabaseId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AnalysisType" AS ENUM ('INDIVIDUAL', 'HISTORY');

-- DropForeignKey
ALTER TABLE "analysis_jobs" DROP CONSTRAINT "analysis_jobs_analysis_id_fkey";

-- DropForeignKey
ALTER TABLE "analysis_jobs" DROP CONSTRAINT "analysis_jobs_user_id_fkey";

-- DropIndex
DROP INDEX "analyses_classification_idx";

-- DropIndex
DROP INDEX "analyses_totalScore_idx";

-- DropIndex
DROP INDEX "users_email_createdAt_idx";

-- AlterTable
ALTER TABLE "analyses" DROP COLUMN "agentScores",
DROP COLUMN "classification",
DROP COLUMN "totalScore",
ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "type" "AnalysisType" NOT NULL DEFAULT 'INDIVIDUAL',
ALTER COLUMN "conversationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "supabaseId" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- DropTable
DROP TABLE "analysis_jobs";

-- CreateIndex
CREATE INDEX "analyses_customerId_idx" ON "analyses"("customerId");

-- CreateIndex
CREATE INDEX "analyses_customerEmail_idx" ON "analyses"("customerEmail");

-- CreateIndex
CREATE INDEX "analyses_type_idx" ON "analyses"("type");

-- CreateIndex
CREATE UNIQUE INDEX "users_supabaseId_key" ON "users"("supabaseId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_supabaseId_idx" ON "users"("supabaseId");
