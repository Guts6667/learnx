-- V4.5-168 — détacher une correction de son auteur à 180 jours.
--
-- La politique de confidentialité le promet déjà aux apprenants — « après
-- 180 jours, une correction IA est détachée de votre compte » — et rien ne le
-- faisait. Cette migration pose ce qu'il faut pour que la phrase devienne
-- vraie (décision `owner-rgpd-2026-08-29` §2).
--
-- DEUX AJOUTS, TOUS DEUX ADDITIFS
--
-- 1. `ai_correction_research_samples` : ce qui reste d'une correction une fois
--    détachée. La table n'a **aucune colonne de rattachement** — ni
--    `correction_id`, ni `user_id` — et sa clé est un pseudonyme tiré au
--    hasard dont aucune correspondance n'est conservée. C'est le tirage, et
--    non une règle applicative, qui rend le détachement irréversible : du code
--    se réécrit, un lien qui n'a jamais été enregistré ne se retrouve pas.
--
--    `detached_on` est une DATE et non un instant : une seconde précise,
--    rapprochée d'un journal applicatif, suffirait à retrouver qui écrivait à
--    ce moment-là.
--
--    Pseudonymisation et non anonymisation : les textes conservés sont ceux de
--    l'apprenant, et un texte libre peut nommer son auteur.
--
-- 2. `users.correction_reuse_consent` : faux par défaut, et le défaut **est**
--    la décision. Un consentement se donne ; il ne se déduit pas d'un silence.
--    Sans lui, les mêmes textes sont supprimés à 180 jours au lieu d'être
--    conservés sous pseudonyme. L'apprenant est détaché dans les deux cas —
--    le consentement ne décide pas du détachement, seulement de ce qui
--    survit à la recherche.
--
-- Aucune donnée existante n'est modifiée : une colonne avec défaut et une
-- table neuve.
--
-- ROLLBACK
-- ========
-- Le retour de code seul ne demande rien. Pour effacer :
--
--   BEGIN;
--   ALTER TABLE "users" DROP COLUMN IF EXISTS "correction_reuse_consent";
--   DROP TABLE IF EXISTS "ai_correction_research_samples";
--   COMMIT;
--
-- Cela détruit des textes que leurs auteurs ne peuvent plus réclamer, faute
-- de lien : personne ne pourra dire ce qui a été perdu. Délibérément non
-- automatisé.

BEGIN;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "correction_reuse_consent" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "ai_correction_research_samples" (
  "pseudonym" UUID NOT NULL,
  "detached_on" DATE NOT NULL,
  "activity_type" TEXT NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "model_id" TEXT,
  "submission_snapshot_json" JSONB NOT NULL,
  "prompt_snapshot_json" JSONB NOT NULL,
  "evidence_quotes_json" JSONB NOT NULL,
  "raw_outputs_json" JSONB NOT NULL,

  CONSTRAINT "ai_correction_research_samples_pkey" PRIMARY KEY ("pseudonym")
);

CREATE INDEX IF NOT EXISTS "ai_correction_research_samples_detached_on_idx"
  ON "ai_correction_research_samples"("detached_on");

ALTER TABLE "ai_corrections"
  ADD COLUMN IF NOT EXISTS "detached_at" TIMESTAMP(3);

-- Les deux colonnes que le détachement vide. `NULL` veut dire détachée, jamais
-- « reçue vide » : toute correction en a une à l'écriture, donc l'absence ne
-- peut venir que de là.
ALTER TABLE "ai_corrections"
  ALTER COLUMN "submission_snapshot_json" DROP NOT NULL;

ALTER TABLE "ai_corrections"
  ALTER COLUMN "prompt_snapshot_json" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "ai_corrections_detached_at_created_at_idx"
  ON "ai_corrections"("detached_at", "created_at");

COMMIT;
