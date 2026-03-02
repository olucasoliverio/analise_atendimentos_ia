-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('NORMAL', 'PRIVATE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'AGENT', 'SYSTEM', 'BOT');

-- CreateEnum
CREATE TYPE "CauseCategory" AS ENUM ('REAL_BUG', 'INCORRECT_USE', 'PRODUCT_LIMITATION', 'CONFIGURATION_ERROR', 'INDETERMINATE');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT,
    "assignedAgentId" TEXT,
    "assignedAgentName" TEXT,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageType" "MessageType" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "hasMedia" BOOLEAN NOT NULL DEFAULT false,
    "mediaUrls" TEXT[],
    "isImportantNote" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyses" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "mainProblem" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "resolutionStatus" TEXT NOT NULL,
    "causeCategory" "CauseCategory" NOT NULL,
    "causeJustification" TEXT NOT NULL,
    "technicalClarity" INTEGER NOT NULL,
    "serviceConducting" INTEGER NOT NULL,
    "empathy" INTEGER NOT NULL,
    "objectivity" INTEGER NOT NULL,
    "ownership" INTEGER NOT NULL,
    "preventionRecontact" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "riskRecontact" "RiskLevel" NOT NULL,
    "riskDissatisfaction" "RiskLevel" NOT NULL,
    "riskChurn" "RiskLevel" NOT NULL,
    "riskJustification" TEXT NOT NULL,
    "keyEvidences" TEXT[],
    "recommendedActions" TEXT[],
    "criticalActions" TEXT[],
    "mediaProcessed" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "processingTime" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
