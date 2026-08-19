-- Postgres truncates identifiers to 63 characters; align this FK's name with
-- the truncated form Prisma expects so `migrate diff` reports no drift.
ALTER TABLE "provider_customized_client_network"
  RENAME CONSTRAINT "provider_customized_client_network_customized_client_network_id" TO "provider_customized_client_network_customized_client_netwo_fkey";
