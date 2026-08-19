-- Mobile money (Orange Money, Wave, ...) as a payment method: payment types
-- get a category, and banking records get a wallet number and merchant code.
CREATE TYPE "PaymentCategory" AS ENUM ('BANK', 'MOBILE_MONEY');

ALTER TABLE "payment_type_ref" ADD COLUMN "category" "PaymentCategory" NOT NULL DEFAULT 'BANK';

ALTER TABLE "banking_payment" ADD COLUMN "mobile_money_number" TEXT;
ALTER TABLE "banking_payment" ADD COLUMN "merchant_code" TEXT;
