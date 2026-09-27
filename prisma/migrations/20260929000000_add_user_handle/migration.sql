-- Staff @handles. Added nullable, backfilled from each account's email
-- (the part before "@", reduced to lowercase letters/digits/dots/underscores;
-- repeats get a number: "amadou", "amadou2"), then made required + unique.
ALTER TABLE "app_user" ADD COLUMN "handle" TEXT;

WITH base AS (
  SELECT id, created_at,
         COALESCE(NULLIF(trim(BOTH '._' FROM regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._]', '', 'g')), ''), 'user') AS h
  FROM "app_user"
), ranked AS (
  SELECT id, h, row_number() OVER (PARTITION BY h ORDER BY created_at, id) AS n FROM base
)
UPDATE "app_user" u
SET handle = CASE WHEN r.n = 1 THEN r.h ELSE r.h || r.n END
FROM ranked r
WHERE r.id = u.id;

ALTER TABLE "app_user" ALTER COLUMN "handle" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "app_user_handle_key" ON "app_user"("handle");
