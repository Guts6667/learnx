-- V4.5-228 — le prénom et le frein d'un prospect.
--
-- Le formulaire d'accès anticipé de la nouvelle landing (lot 219–229) demande
-- un prénom, ce que la personne veut apprendre, et — facultatif — ce qui la
-- ralentit d'habitude. Les deux premiers avaient déjà leur place :
-- `public_contacts.email_normalized` et `public_leads.motivation`. Les deux
-- colonnes ci-dessous manquaient (décision D6 = b, 5 septembre 2026).
--
-- DEUX AJOUTS, TOUS DEUX ADDITIFS
--
-- 1. `public_leads.first_name` : nullable en base, exigé par la validation
--    pour une candidature EARLY_ADOPTER seulement. Un simple abonnement aux
--    nouvelles peut ne pas en porter — la colonne ne peut donc pas être NOT
--    NULL sans inventer une valeur pour les lignes déjà écrites.
--
-- 2. `public_leads.friction` : toujours facultatif, et refusé par la
--    validation sur un abonnement. C'est une question de candidature ; un
--    abonnement n'a aucune raison de la porter (minimisation, comme
--    `motivation` avant lui).
--
-- Les deux colonnes vivent sur `public_leads` et non sur `public_contacts` :
-- ce sont des réponses à un formulaire, datées et rattachées au motif qui les
-- a demandées, et non des attributs stables de la personne. Une même adresse
-- qui candidate deux fois à six mois d'écart a deux réponses, pas une valeur
-- écrasée.
--
-- Bornes appliquées par la validation Zod, pas par la base : 80 caractères
-- pour le prénom, 2 000 pour le frein. `TEXT` ici, comme `motivation`, parce
-- qu'une borne SQL qui diverge de la borne applicative se découvre en
-- production, sur un rejet que personne n'attendait.
--
-- Rien de destructif : aucune colonne retirée, aucune ligne réécrite, aucune
-- valeur par défaut posée sur l'existant.
--
-- ROLLBACK
-- ========
--   BEGIN;
--   ALTER TABLE "public_leads" DROP COLUMN IF EXISTS "first_name";
--   ALTER TABLE "public_leads" DROP COLUMN IF EXISTS "friction";
--   COMMIT;

BEGIN;

ALTER TABLE "public_leads"
  ADD COLUMN IF NOT EXISTS "first_name" TEXT;

ALTER TABLE "public_leads"
  ADD COLUMN IF NOT EXISTS "friction" TEXT;

COMMIT;
