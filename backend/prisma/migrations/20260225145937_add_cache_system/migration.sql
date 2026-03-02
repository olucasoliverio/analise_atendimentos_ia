/*
  Warnings:

  - You are about to drop the column `causeCategory` on the `analyses` table. All the data in the column will be lost.
  - You are about to drop the column `causeJustification` on the `analyses` table. All the data in the column will be lost.
  - You are about to drop the column `context` on the `analyses` table. All the data in the column will be lost.
  - You are about to drop the column `criticalActions` on the `analyses` table. All the data in the column will be lost.
  - You are about to drop the column `empathy` on the `analyses` table. All the data in the column will be lost.
  - You are about to drop the column `keyEvidences` on the `analyses` table. All the data in the column will be lost.
  - You are about to drop the column `objectivity` on the `analyses` table. All the data in the column will be lost.
  - You are about to drop the column `ownership` on the `analyses` table. All the data in the column will be lost.
  - You are about to drop the column `preventionRecontact` on the `analyses` table. All the data in the column will be lost.
  - You are about to drop the column `resolutionStatus` on the `analyses` table. All the data in the column will be lost.
  - You are about to drop the column `riskJustification` on the `analyses` table. All the data in the column will be lost.
  - You are about to drop the column `serviceConducting` on the `analyses` table. All the data in the column will be lost.
  - You are about to drop the column `technicalClarity` on the `analyses` table. All the data in the column will be lost.
  - The `riskLevel` column on the `analyses` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `riskRecontact` column on the `analyses` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `riskDissatisfaction` column on the `analyses` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `riskChurn` column on the `analyses` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `recommendedActions` column on the `analyses` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[freshchatMessageId]` on the table `messages` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `freshchatMessageId` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `messageType` on the `messages` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `actorType` on the `messages` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "analyses" DROP CONSTRAINT "analyses_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "analyses" DROP CONSTRAINT "analyses_userId_fkey";

-- DropIndex
DROP INDEX "analyses_userId_conversationId_createdAt_idx";

-- AlterTable
ALTER TABLE "analyses" DROP COLUMN "causeCategory",
DROP COLUMN "causeJustification",
DROP COLUMN "context",
DROP COLUMN "criticalActions",
DROP COLUMN "empathy",
DROP COLUMN "keyEvidences",
DROP COLUMN "objectivity",
DROP COLUMN "ownership",
DROP COLUMN "preventionRecontact",
DROP COLUMN "resolutionStatus",
DROP COLUMN "riskJustification",
DROP COLUMN "serviceConducting",
DROP COLUMN "technicalClarity",
ADD COLUMN     "agentScores" JSONB,
ADD COLUMN     "classification" TEXT,
ADD COLUMN     "timeline" JSONB,
ADD COLUMN     "totalScore" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "mainProblem" DROP NOT NULL,
DROP COLUMN "riskLevel",
ADD COLUMN     "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
DROP COLUMN "riskRecontact",
ADD COLUMN     "riskRecontact" TEXT NOT NULL DEFAULT 'LOW',
DROP COLUMN "riskDissatisfaction",
ADD COLUMN     "riskDissatisfaction" TEXT NOT NULL DEFAULT 'LOW',
DROP COLUMN "riskChurn",
ADD COLUMN     "riskChurn" TEXT NOT NULL DEFAULT 'LOW',
DROP COLUMN "recommendedActions",
ADD COLUMN     "recommendedActions" JSONB,
ALTER COLUMN "tokensUsed" DROP NOT NULL,
ALTER COLUMN "tokensUsed" DROP DEFAULT,
ALTER COLUMN "processingTime" DROP NOT NULL,
ALTER COLUMN "processingTime" DROP DEFAULT;

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "agentMessageCount" INTEGER,
ADD COLUMN     "averageResponseTime" INTEGER,
ADD COLUMN     "channelId" TEXT,
ADD COLUMN     "customerMessageCount" INTEGER,
ADD COLUMN     "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "messageCount" INTEGER,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "freshchatMessageId" TEXT NOT NULL,
ADD COLUMN     "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "messageType",
ADD COLUMN     "messageType" TEXT NOT NULL,
DROP COLUMN "actorType",
ADD COLUMN     "actorType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;

-- DropEnum
DROP TYPE "ActorType";

-- DropEnum
DROP TYPE "CauseCategory";

-- DropEnum
DROP TYPE "MessageType";

-- DropEnum
DROP TYPE "RiskLevel";

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fetchCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "displayName" TEXT,
    "phone" TEXT,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fetchCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_email_key" ON "agents"("email");

-- CreateIndex
CREATE INDEX "agents_email_idx" ON "agents"("email");

-- CreateIndex
CREATE INDEX "agents_lastFetchedAt_idx" ON "agents"("lastFetchedAt");

-- CreateIndex
CREATE INDEX "agents_active_idx" ON "agents"("active");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_lastFetchedAt_idx" ON "customers"("lastFetchedAt");

-- CreateIndex
CREATE INDEX "analyses_riskLevel_idx" ON "analyses"("riskLevel");

-- CreateIndex
CREATE INDEX "analyses_classification_idx" ON "analyses"("classification");

-- CreateIndex
CREATE INDEX "analyses_totalScore_idx" ON "analyses"("totalScore");

-- CreateIndex
CREATE INDEX "conversations_assignedAgentId_idx" ON "conversations"("assignedAgentId");

-- CreateIndex
CREATE INDEX "conversations_status_idx" ON "conversations"("status");

-- CreateIndex
CREATE INDEX "conversations_lastFetchedAt_idx" ON "conversations"("lastFetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "messages_freshchatMessageId_key" ON "messages"("freshchatMessageId");

-- CreateIndex
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");

-- CreateIndex
CREATE INDEX "messages_freshchatMessageId_idx" ON "messages"("freshchatMessageId");

-- CreateIndex
CREATE INDEX "messages_actorType_idx" ON "messages"("actorType");

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
