-- Specialized Network / Customized Client Network: two admin-managed value lists, each assignable many-to-many to a provider.
CREATE TABLE "specialized_network_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specialized_network_ref_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "specialized_network_ref_code_key" ON "specialized_network_ref"("code");

CREATE TABLE "customized_client_network_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customized_client_network_ref_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customized_client_network_ref_code_key" ON "customized_client_network_ref"("code");

CREATE TABLE "provider_specialized_network" (
    "provider_id" UUID NOT NULL,
    "specialized_network_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_specialized_network_pkey" PRIMARY KEY ("provider_id","specialized_network_id")
);

ALTER TABLE "provider_specialized_network" ADD CONSTRAINT "provider_specialized_network_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_specialized_network" ADD CONSTRAINT "provider_specialized_network_specialized_network_id_fkey" FOREIGN KEY ("specialized_network_id") REFERENCES "specialized_network_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "provider_customized_client_network" (
    "provider_id" UUID NOT NULL,
    "customized_client_network_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_customized_client_network_pkey" PRIMARY KEY ("provider_id","customized_client_network_id")
);

ALTER TABLE "provider_customized_client_network" ADD CONSTRAINT "provider_customized_client_network_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_customized_client_network" ADD CONSTRAINT "provider_customized_client_network_customized_client_network_id_fkey" FOREIGN KEY ("customized_client_network_id") REFERENCES "customized_client_network_ref"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
