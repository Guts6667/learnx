-- Persist login failures so rate limiting is shared by every serverless instance.
CREATE TABLE "login_rate_limits" (
    "key_hash" TEXT NOT NULL,
    "failures" INTEGER NOT NULL,
    "window_started_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_rate_limits_pkey" PRIMARY KEY ("key_hash")
);

CREATE INDEX "login_rate_limits_window_started_at_idx"
    ON "login_rate_limits"("window_started_at");
