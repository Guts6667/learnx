-- V4.5-203 — compenser un remboursement émis chez le fournisseur.
--
-- Deux ajouts, tous deux additifs, pour un même besoin : jusqu'ici un
-- remboursement émis depuis le tableau de bord Stripe rendait l'argent et
-- laissait les crédits en place (étape 3 de la passe, 30 août 2026). La
-- compensation automatique demande deux choses que le schéma ne permettait
-- pas.
--
-- 1. UN AUTEUR QUI N'EST PAS UNE PERSONNE
--
-- `audit_events.actor_user_id` n'est pas nullable et référence `users`, parce
-- que tout acte audité avait jusqu'ici un humain derrière lui. Un
-- remboursement fournisseur n'en a pas. Nommer l'apprenant serait faux : il
-- n'a rien fait. On insère donc une ligne qui n'est pas une personne, à
-- identifiant fixe pour que ce soit la même dans tous les environnements.
--
-- Elle ne peut pas se connecter : son statut est `suspended` et toute
-- recherche de session exige `active` — la garantie est celle qui existe
-- déjà, pas une promesse neuve. Son empreinte de mot de passe est une valeur
-- dont rien n'est le condensat.
--
-- Le registre de crédits n'a besoin de rien de tout cela :
-- `credit_ledger_entries.actor_user_id` est déjà nullable, donc une écriture
-- compensatoire dit simplement qu'aucun humain n'a agi. Ce compte existe pour
-- la piste d'audit, qui ne sait pas le dire.
--
-- 2. UNE ISSUE POUR LE REMBOURSEMENT PARTIEL
--
-- `charge.refunded` est émis aussi pour un remboursement partiel. La règle de
-- prorata (`voluntaryRefundMinor`) répond à « l'apprenant rend tout ce qu'il
-- n'a pas consommé » : appliquée à un remboursement de 5 € sur 20 €, elle
-- reprendrait la totalité des crédits restants et inscrirait un remboursement
-- plus grand que l'argent réellement sorti. Décision : seuls les
-- remboursements complets compensent automatiquement ; un partiel est
-- enregistré, n'applique rien, et se voit. Il lui faut donc son propre nom —
-- `applied` serait faux, `out_of_order` le déguiserait en cas anodin
-- (V4.5-198).
--
-- ROLLBACK
-- ========
-- Le retour de code seul ne demande rien. Pour retirer le compte technique :
--
--   BEGIN;
--   DELETE FROM "users" WHERE "id" = '00000000-0000-4000-8000-000000000001';
--   COMMIT;
--
-- Cela échoue dès qu'un événement d'audit le référence, et c'est voulu : la
-- suppression effacerait la trace de remboursements réellement effectués.
-- PostgreSQL ne sait pas retirer une valeur d'un type énuméré ; voir la
-- migration 20260830180000 pour la procédure. Délibérément non automatisé.

ALTER TYPE "payment_event_outcome" ADD VALUE IF NOT EXISTS 'partial_refund';

-- Seules les colonnes sans valeur par défaut sont nommées, plus celles dont
-- la valeur compte ici. Une colonne obligatoire ajoutée plus tard avec un
-- défaut ne cassera donc pas cette insertion.

BEGIN;

INSERT INTO "users" (
  "id", "email", "password_hash", "display_name",
  "account_status", "suspended_at", "updated_at"
)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'system@accounts.invalid',
  'system:no-password-hashes-to-this-value',
  'LearnX (système)',
  'suspended',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

COMMIT;
