-- 1-5 star Quality and Access ratings on the provider (null = not rated).
ALTER TABLE "provider" ADD COLUMN "quality_rating" INTEGER;
ALTER TABLE "provider" ADD COLUMN "access_rating" INTEGER;

ALTER TABLE "provider" ADD CONSTRAINT "provider_quality_rating_range" CHECK ("quality_rating" BETWEEN 1 AND 5);
ALTER TABLE "provider" ADD CONSTRAINT "provider_access_rating_range" CHECK ("access_rating" BETWEEN 1 AND 5);
