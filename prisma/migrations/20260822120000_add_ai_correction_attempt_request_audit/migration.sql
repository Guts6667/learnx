-- Persist only the redacted, reproducible request manifest and hashes. The
-- request body itself, prompts, submissions, credentials and HTTP headers must
-- never be stored in these audit columns.
CREATE TYPE "ai_correction_cost_source" AS ENUM (
  'actual',
  'conservative_write_off'
);

ALTER TABLE "ai_correction_attempts"
  ADD COLUMN "request_manifest_json" JSONB,
  ADD COLUMN "request_body_sha256" CHAR(64),
  ADD COLUMN "wire_schema_sha256" CHAR(64),
  ADD COLUMN "router_metadata_json" JSONB,
  ADD COLUMN "cost_source" "ai_correction_cost_source",
  ADD CONSTRAINT "ai_correction_attempts_request_body_sha256_check" CHECK (
    "request_body_sha256" IS NULL OR
    "request_body_sha256" ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT "ai_correction_attempts_wire_schema_sha256_check" CHECK (
    "wire_schema_sha256" IS NULL OR
    "wire_schema_sha256" ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT "ai_correction_attempts_request_manifest_object_check" CHECK (
    "request_manifest_json" IS NULL OR
    jsonb_typeof("request_manifest_json") = 'object'
  ),
  ADD CONSTRAINT "ai_correction_attempts_router_metadata_object_check" CHECK (
    "router_metadata_json" IS NULL OR
    jsonb_typeof("router_metadata_json") = 'object'
  ),
  ADD CONSTRAINT "ai_correction_attempts_request_manifest_no_sensitive_keys_check" CHECK (
    "request_manifest_json" IS NULL OR
    "request_manifest_json"::text !~* '"(authorization|cookie|headers|api[_-]?key|secret|password|access[_-]?token|refresh[_-]?token|messages|content|prompt|submission|request[_-]?body|raw[_-]?(output|response))"[[:space:]]*:'
  ),
  ADD CONSTRAINT "ai_correction_attempts_router_metadata_no_sensitive_keys_check" CHECK (
    "router_metadata_json" IS NULL OR
    "router_metadata_json"::text !~* '"(authorization|cookie|headers|api[_-]?key|secret|password|access[_-]?token|refresh[_-]?token|messages|content|prompt|submission|request[_-]?body|raw[_-]?(output|response))"[[:space:]]*:'
  ),
  ADD CONSTRAINT "ai_correction_attempts_request_manifest_no_bearer_check" CHECK (
    "request_manifest_json" IS NULL OR
    "request_manifest_json"::text !~* 'bearer[[:space:]]+[a-z0-9._~+/-]+'
  ),
  ADD CONSTRAINT "ai_correction_attempts_router_metadata_no_bearer_check" CHECK (
    "router_metadata_json" IS NULL OR
    "router_metadata_json"::text !~* 'bearer[[:space:]]+[a-z0-9._~+/-]+'
  );

COMMENT ON COLUMN "ai_correction_attempts"."request_manifest_json" IS
  'Redacted request identity manifest persisted at CALL_INTENT; no prompt, submission, request body, HTTP header or credential.';
COMMENT ON COLUMN "ai_correction_attempts"."request_body_sha256" IS
  'Lowercase SHA-256 of the canonical provider request body; the body is not persisted here.';
COMMENT ON COLUMN "ai_correction_attempts"."wire_schema_sha256" IS
  'Lowercase SHA-256 of the exact structured-output schema sent on the wire.';
COMMENT ON COLUMN "ai_correction_attempts"."router_metadata_json" IS
  'Redacted router metadata only; provider, generation_id and provider_request_id remain in their existing columns.';
COMMENT ON COLUMN "ai_correction_attempts"."cost_source" IS
  'Explicit source for a known cost; NULL means unknown and is never converted automatically to a conservative write-off.';
