-- V4.5-197 — rendre le corps d'événement effaçable (décision `owner-e4-2026-08-30`).
--
-- E4 de l'audit RGPD : le corps brut de chaque événement de paiement est
-- conservé intégralement, sans limite, et l'effacement d'un compte ne le
-- touche pas. La passe bac à sable du 30 août a levé le doute — ce ne sont
-- pas des métadonnées : `data.object` porte `customer_details`
-- (`email`, `name`, `phone`, `address` complète), `customer_email` et
-- `customer`. Des identifiants directs, dans une table que rien ne purge.
--
-- La décision du Propriétaire garde la trace comptable en colonnes
-- (identifiant d'événement, type, commande, montants, devise, statut,
-- horodatages) et purge le corps 30 jours après réception. La colonne doit
-- donc pouvoir être vide.
--
-- `NULL` veut dire **purgé**, jamais « reçu vide » : tout événement
-- enregistré a un corps à l'écriture (`payment-webhook.ts` passe
-- `JSON.parse(rawPayload)`), donc l'absence ne peut venir que de la purge ou
-- d'un effacement de compte. C'est ce qui rend la purge attestable sans
-- colonne supplémentaire.
--
-- Additif au sens où rien n'est perdu : lever une contrainte n'invalide
-- aucune ligne existante, et aucune lecture ne dépend de la colonne — elle
-- n'est relue nulle part dans le code, seulement écrite.
--
-- ROLLBACK
-- ========
-- Le retour de code seul ne demande rien. Pour rétablir la contrainte :
--
--   BEGIN;
--   ALTER TABLE "payment_events" ALTER COLUMN "payload_json" SET NOT NULL;
--   COMMIT;
--
-- Cela échoue si une seule ligne a déjà été purgée, et c'est voulu : le
-- rétablir supposerait de réinventer un corps que nous avons effacé pour une
-- raison. Délibérément non automatisé.

BEGIN;

ALTER TABLE "payment_events" ALTER COLUMN "payload_json" DROP NOT NULL;

COMMIT;
