-- The bounded V4 Writing pilot is formative: it persists an indicative score
-- when every criterion is publishable, but it never stores a PASS/FAIL
-- decision, an authoritative score or a model confidence. Keep the legacy
-- terminal shapes valid while allowing the promoted formative result shape.
ALTER TABLE "ai_corrections"
  DROP CONSTRAINT "ai_corrections_terminal_result_check";

ALTER TABLE "ai_corrections"
  ADD CONSTRAINT "ai_corrections_terminal_result_check" CHECK (
    (
      "pipeline_kind" = 'single_model' AND (
        (
          "status" = 'completed' AND
          "decision" IN ('passed', 'not_passed') AND
          "structured_result_json" IS NOT NULL AND
          "score" IS NOT NULL AND
          "confidence" IS NOT NULL AND
          "completed_at" IS NOT NULL
        ) OR (
          "status" = 'ai_review_required' AND
          "decision" = 'review_required' AND
          "structured_result_json" IS NOT NULL AND
          "score" IS NOT NULL AND
          "confidence" IS NOT NULL AND
          "completed_at" IS NOT NULL
        ) OR (
          "status" IN ('completed', 'provisional') AND
          "decision" IS NULL AND
          "structured_result_json" IS NOT NULL AND
          "score" IS NULL AND
          "confidence" IS NULL AND
          "completed_at" IS NOT NULL
        ) OR (
          "status" NOT IN (
            'completed',
            'provisional',
            'ai_review_required'
          ) AND
          "decision" IS NULL AND
          "structured_result_json" IS NULL AND
          "score" IS NULL AND
          "confidence" IS NULL
        )
      )
    ) OR (
      "pipeline_kind" = 'composite' AND
      "decision" IS NULL AND
      "score" IS NULL AND
      "confidence" IS NULL AND (
        (
          "status" IN ('completed', 'provisional') AND
          "consolidation_json" IS NOT NULL AND
          "structured_result_json" IS NOT NULL AND
          "indicative_score" IS NOT NULL AND
          "completed_at" IS NOT NULL
        ) OR (
          "status" = 'uncertain' AND
          "consolidation_json" IS NOT NULL AND
          "indicative_score" IS NULL AND
          "completed_at" IS NOT NULL
        ) OR (
          "status" IN ('unusable_released', 'failed_released') AND
          "structured_result_json" IS NULL AND
          "indicative_score" IS NULL AND
          "completed_at" IS NOT NULL
        ) OR (
          "status" IN (
            'reserved',
            'processing_primary',
            'verifying',
            'retry_pending',
            'settlement_pending',
            'release_pending',
            'reconciliation_required'
          ) AND
          "completed_at" IS NULL
        )
      )
    )
  );
