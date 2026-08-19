-- Per-user override of UserRole.max_search_results; null = use the role's default.
ALTER TABLE "app_user" ADD COLUMN "max_search_results" INTEGER;
