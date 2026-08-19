-- Caps how many search results a role's users can retrieve; null = unlimited.
ALTER TABLE "user_role" ADD COLUMN "max_search_results" INTEGER;
