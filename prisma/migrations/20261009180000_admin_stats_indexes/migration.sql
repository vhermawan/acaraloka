-- CreateIndex
CREATE INDEX "events_published_at_idx" ON "events"("published_at");

-- CreateIndex
CREATE INDEX "registrations_created_at_idx" ON "registrations"("created_at");

-- CreateIndex
CREATE INDEX "user_createdAt_idx" ON "user"("createdAt");
