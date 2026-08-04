-- Additive account lifecycle types. Existing users remain active.
CREATE TYPE "account_status" AS ENUM ('active', 'suspended');
CREATE TYPE "access_request_status" AS ENUM (
  'pending_email',
  'pending_approval',
  'approved',
  'rejected'
);

ALTER TABLE "users"
  ADD COLUMN "account_status" "account_status" NOT NULL DEFAULT 'active',
  ADD COLUMN "suspended_at" TIMESTAMP(3);

ALTER TABLE "users"
  ADD CONSTRAINT "users_account_status_consistency_check"
  CHECK (
    ("account_status" = 'active' AND "suspended_at" IS NULL)
    OR
    ("account_status" = 'suspended' AND "suspended_at" IS NOT NULL)
  );

CREATE TABLE "access_requests" (
  "id" UUID NOT NULL,
  "email_normalized" TEXT NOT NULL,
  "status" "access_request_status" NOT NULL DEFAULT 'pending_email',
  "version" INTEGER NOT NULL DEFAULT 1,
  "email_verified_at" TIMESTAMP(3),
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by_user_id" UUID,
  "rejection_reason" TEXT,
  "activated_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "access_requests_version_check" CHECK ("version" > 0),
  CONSTRAINT "access_requests_email_normalized_check" CHECK (
    "email_normalized" = LOWER(BTRIM("email_normalized"))
    AND LENGTH("email_normalized") BETWEEN 3 AND 320
  ),
  CONSTRAINT "access_requests_review_consistency_check" CHECK (
    ("reviewed_at" IS NULL AND "reviewed_by_user_id" IS NULL)
    OR
    ("reviewed_at" IS NOT NULL AND "reviewed_by_user_id" IS NOT NULL)
  ),
  CONSTRAINT "access_requests_status_consistency_check" CHECK (
    (
      "status" = 'pending_email'
      AND "email_verified_at" IS NULL
      AND "reviewed_at" IS NULL
      AND "rejection_reason" IS NULL
      AND "activated_user_id" IS NULL
    )
    OR
    (
      "status" = 'pending_approval'
      AND "email_verified_at" IS NOT NULL
      AND "reviewed_at" IS NULL
      AND "rejection_reason" IS NULL
      AND "activated_user_id" IS NULL
    )
    OR
    (
      "status" = 'approved'
      AND "email_verified_at" IS NOT NULL
      AND "reviewed_at" IS NOT NULL
      AND "rejection_reason" IS NULL
    )
    OR
    (
      "status" = 'rejected'
      AND "email_verified_at" IS NOT NULL
      AND "reviewed_at" IS NOT NULL
      AND "rejection_reason" IS NOT NULL
      AND LENGTH(BTRIM("rejection_reason")) > 0
      AND "activated_user_id" IS NULL
    )
  )
);

CREATE TABLE "email_verifications" (
  "id" UUID NOT NULL,
  "access_request_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "invalidated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_verifications_expiry_check" CHECK (
    "expires_at" > "created_at"
  ),
  CONSTRAINT "email_verifications_terminal_state_check" CHECK (
    "consumed_at" IS NULL OR "invalidated_at" IS NULL
  )
);

CREATE TABLE "access_invitations" (
  "id" UUID NOT NULL,
  "access_request_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "assigned_role" "user_role" NOT NULL DEFAULT 'user',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "invalidated_at" TIMESTAMP(3),
  "invited_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "access_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "access_invitations_expiry_check" CHECK (
    "expires_at" > "created_at"
  ),
  CONSTRAINT "access_invitations_terminal_state_check" CHECK (
    "consumed_at" IS NULL OR "invalidated_at" IS NULL
  )
);

CREATE UNIQUE INDEX "access_requests_activated_user_id_key"
  ON "access_requests"("activated_user_id");
CREATE INDEX "access_requests_email_normalized_status_idx"
  ON "access_requests"("email_normalized", "status");
CREATE INDEX "access_requests_status_created_at_idx"
  ON "access_requests"("status", "created_at");
CREATE UNIQUE INDEX "access_requests_open_email_key"
  ON "access_requests"("email_normalized")
  WHERE "status" IN ('pending_email', 'pending_approval', 'approved');

CREATE UNIQUE INDEX "email_verifications_token_hash_key"
  ON "email_verifications"("token_hash");
CREATE INDEX "email_verifications_access_request_id_expires_at_idx"
  ON "email_verifications"("access_request_id", "expires_at");
CREATE INDEX "email_verifications_expires_at_idx"
  ON "email_verifications"("expires_at");
CREATE UNIQUE INDEX "email_verifications_active_request_key"
  ON "email_verifications"("access_request_id")
  WHERE "consumed_at" IS NULL AND "invalidated_at" IS NULL;

CREATE UNIQUE INDEX "access_invitations_token_hash_key"
  ON "access_invitations"("token_hash");
CREATE INDEX "access_invitations_access_request_id_expires_at_idx"
  ON "access_invitations"("access_request_id", "expires_at");
CREATE INDEX "access_invitations_expires_at_idx"
  ON "access_invitations"("expires_at");
CREATE INDEX "access_invitations_invited_by_user_id_idx"
  ON "access_invitations"("invited_by_user_id");
CREATE UNIQUE INDEX "access_invitations_active_request_key"
  ON "access_invitations"("access_request_id")
  WHERE "consumed_at" IS NULL AND "invalidated_at" IS NULL;

-- Cross-table lifecycle guards complement the row-level CHECK constraints.
CREATE FUNCTION "assert_email_verification_request_state"()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "access_requests"
    WHERE "id" = NEW."access_request_id"
      AND "status" = 'pending_email'
  ) THEN
    RAISE EXCEPTION 'email verification requires a pending_email request'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "email_verifications_request_state_guard"
BEFORE INSERT ON "email_verifications"
FOR EACH ROW EXECUTE FUNCTION "assert_email_verification_request_state"();

CREATE FUNCTION "assert_access_invitation_request_state"()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "access_requests"
    WHERE "id" = NEW."access_request_id"
      AND "status" = 'approved'
  ) THEN
    RAISE EXCEPTION 'access invitation requires an approved request'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "access_invitations_request_state_guard"
BEFORE INSERT ON "access_invitations"
FOR EACH ROW EXECUTE FUNCTION "assert_access_invitation_request_state"();

ALTER TABLE "access_requests"
  ADD CONSTRAINT "access_requests_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "access_requests"
  ADD CONSTRAINT "access_requests_activated_user_id_fkey"
  FOREIGN KEY ("activated_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_verifications"
  ADD CONSTRAINT "email_verifications_access_request_id_fkey"
  FOREIGN KEY ("access_request_id") REFERENCES "access_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "access_invitations"
  ADD CONSTRAINT "access_invitations_access_request_id_fkey"
  FOREIGN KEY ("access_request_id") REFERENCES "access_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "access_invitations"
  ADD CONSTRAINT "access_invitations_invited_by_user_id_fkey"
  FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
