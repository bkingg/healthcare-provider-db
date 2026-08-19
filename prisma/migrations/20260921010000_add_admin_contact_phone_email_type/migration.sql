-- Administrative contact phones/emails get a type from the same value lists
-- as the provider's own phones/emails. Nullable: existing rows have none.
ALTER TABLE "administrative_contact_phone" ADD COLUMN "phone_type_id" UUID;
ALTER TABLE "administrative_contact_email" ADD COLUMN "email_type_id" UUID;

ALTER TABLE "administrative_contact_phone" ADD CONSTRAINT "administrative_contact_phone_phone_type_id_fkey" FOREIGN KEY ("phone_type_id") REFERENCES "phone_type_ref"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "administrative_contact_email" ADD CONSTRAINT "administrative_contact_email_email_type_id_fkey" FOREIGN KEY ("email_type_id") REFERENCES "email_type_ref"("id") ON DELETE SET NULL ON UPDATE CASCADE;
