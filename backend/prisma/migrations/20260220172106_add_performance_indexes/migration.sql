-- CreateIndex
CREATE INDEX "analyses_userId_createdAt_idx" ON "analyses"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "analyses_conversationId_userId_idx" ON "analyses"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "analyses_userId_conversationId_createdAt_idx" ON "analyses"("userId", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "conversations_customerId_idx" ON "conversations"("customerId");

-- CreateIndex
CREATE INDEX "conversations_customerEmail_idx" ON "conversations"("customerEmail");

-- CreateIndex
CREATE INDEX "conversations_assignedAgentName_idx" ON "conversations"("assignedAgentName");

-- CreateIndex
CREATE INDEX "conversations_createdAt_idx" ON "conversations"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "users_email_createdAt_idx" ON "users"("email", "createdAt");
