-- Countries are grouped by Region (a managed value list); the free-text
-- "geo region" duplicated it and was not used anywhere.
ALTER TABLE "country_ref" DROP COLUMN "geo_region";
