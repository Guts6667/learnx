ALTER TABLE "users"
ADD COLUMN "locale" VARCHAR(2) NOT NULL DEFAULT 'fr';

ALTER TABLE "access_requests"
ADD COLUMN "locale" VARCHAR(2) NOT NULL DEFAULT 'fr';

ALTER TABLE "users"
ADD CONSTRAINT "users_locale_check" CHECK ("locale" IN ('fr', 'en'));

ALTER TABLE "access_requests"
ADD CONSTRAINT "access_requests_locale_check" CHECK ("locale" IN ('fr', 'en'));
