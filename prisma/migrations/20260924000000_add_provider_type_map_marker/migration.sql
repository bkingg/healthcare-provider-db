-- Admin-editable map marker style per provider type. Both nullable: null
-- falls back to the built-in default for the type's code (see
-- src/lib/mapMarkerStyle.ts), so existing rows need no backfill.
ALTER TABLE "provider_type_ref" ADD COLUMN "map_icon" TEXT,
ADD COLUMN "map_color" TEXT;
