-- DropIndex
DROP INDEX "customers_email_key";

-- AlterTable
ALTER TABLE "analyses" ALTER COLUMN "updatedAt" DROP DEFAULT;
