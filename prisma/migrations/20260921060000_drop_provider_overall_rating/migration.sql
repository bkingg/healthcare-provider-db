-- The provider-level "overall rating" (a RatingScaleRef pointer nothing could
-- set, and no provider used) is retired: the rating scale now describes a
-- country's healthcare system, and providers carry their own Quality/Access
-- star ratings.
ALTER TABLE "provider" DROP COLUMN "overall_rating_id";
