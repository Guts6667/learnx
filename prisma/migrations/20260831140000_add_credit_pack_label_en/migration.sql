-- V4.5-212 — un libellé anglais à côté du français.
--
-- `/api/public/credit-packs` est mis en cache « le même pour tout le monde »
-- pendant cinq minutes, pour que la page d'accueil n'interroge pas la base à
-- chaque visite. Résoudre la langue côté serveur imposerait un `Vary` et
-- diviserait ce cache. Les deux libellés partent ensemble, l'écran choisit :
-- il connaît déjà sa langue.
--
-- Le défaut vide n'est pas une valeur de repli mais une contrainte de
-- migration : la colonne est obligatoire et des lignes existent. La graine des
-- paliers (V4.5-212) écrit les vrais libellés, et le placeholder d'aperçu est
-- désactivé au passage.
--
-- ROLLBACK
-- ========
--   BEGIN;
--   ALTER TABLE "credit_packs" DROP COLUMN IF EXISTS "label_en";
--   COMMIT;

BEGIN;

ALTER TABLE "credit_packs"
  ADD COLUMN IF NOT EXISTS "label_en" TEXT NOT NULL DEFAULT '';

COMMIT;
