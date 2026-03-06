-- Prevent accidental cascade deletions from cache cleanup.
-- Keep conversations and analyses protected from parent-row removals.

-- DropForeignKey
ALTER TABLE "analyses" DROP CONSTRAINT "analyses_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_customerId_fkey";

-- AddForeignKey
ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "customers"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses"
ADD CONSTRAINT "analyses_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "conversations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
