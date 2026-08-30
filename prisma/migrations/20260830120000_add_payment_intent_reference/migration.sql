-- V4.5-195 — le second identifiant Stripe d'une commande.
--
-- `provider_order_id` est l'identifiant de session Checkout : c'est ce que
-- Stripe appelle la commande, et c'est la clé de rapprochement. Mais il
-- n'apparaît que sur les événements `checkout.session.*`. Un remboursement
-- (`charge.refunded`) et un litige (`charge.dispute.*`) portent un objet
-- « charge », qui ne contient ni cet identifiant ni `client_reference_id` :
-- seul `payment_intent` traverse tout le cycle de vie.
--
-- Sans cette colonne, un achat s'attribue correctement et **tout
-- remboursement arrive comme commande inconnue** : enregistré, jamais
-- appliqué, la commande restant « honorée » pendant que l'argent est reparti.
--
-- Additif : une colonne nullable et son index unique. Rien d'existant n'est
-- modifié, les lignes déjà présentes restent valides avec la valeur NULL, et
-- l'unicité ne contraint que les lignes renseignées (Postgres ignore NULL
-- dans un index unique).
--
-- ROLLBACK
-- ========
-- Le retour de code seul ne demande rien : la colonne cesse simplement d'être
-- lue. Pour l'effacer :
--
--   BEGIN;
--   DROP INDEX IF EXISTS "payment_orders_provider_payment_intent_id_key";
--   ALTER TABLE "payment_orders"
--     DROP COLUMN IF EXISTS "provider_payment_intent_id";
--   COMMIT;
--
-- Cela détruit le lien entre une commande et ses événements de charge, donc
-- la capacité à rattacher un remboursement déjà reçu. Délibérément non
-- automatisé.

BEGIN;

ALTER TABLE "payment_orders"
  ADD COLUMN IF NOT EXISTS "provider_payment_intent_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS
  "payment_orders_provider_payment_intent_id_key"
  ON "payment_orders"("provider_payment_intent_id");

COMMIT;
