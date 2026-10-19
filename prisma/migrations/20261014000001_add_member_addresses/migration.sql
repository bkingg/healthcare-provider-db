-- CreateTable
CREATE TABLE "member_address" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PRIMARY',
    "address_text" TEXT NOT NULL,
    "directions" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "member_address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_address_member_id_kind_key" ON "member_address"("member_id", "kind");

-- AddForeignKey
ALTER TABLE "member_address" ADD CONSTRAINT "member_address_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

