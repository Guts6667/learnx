ALTER TABLE "notes"
ADD COLUMN "sequence_item_id" UUID,
ADD COLUMN "creation_key" UUID;

CREATE INDEX "notes_sequence_item_id_idx" ON "notes"("sequence_item_id");

CREATE UNIQUE INDEX "notes_user_id_creation_key_key"
ON "notes"("user_id", "creation_key");

ALTER TABLE "notes"
ADD CONSTRAINT "notes_sequence_item_id_fkey"
FOREIGN KEY ("sequence_item_id") REFERENCES "lesson_sequence_items"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
