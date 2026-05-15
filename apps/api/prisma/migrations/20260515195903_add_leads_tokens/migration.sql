/*
  Warnings:

  - You are about to drop the column `company` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `score` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `stage` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `ref` on the `token_ledger` table. All the data in the column will be lost.
  - You are about to drop the column `tenantId` on the `token_ledger` table. All the data in the column will be lost.
  - Added the required column `walletId` to the `token_ledger` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `token_ledger` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "token_ledger" DROP CONSTRAINT "token_ledger_tenantId_fkey";

-- AlterTable
ALTER TABLE "leads" DROP COLUMN "company",
DROP COLUMN "score",
DROP COLUMN "stage",
ADD COLUMN     "area" TEXT,
ADD COLUMN     "contactScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "crmStage" TEXT NOT NULL DEFAULT 'NEW',
ADD COLUMN     "emailType" TEXT,
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "organization" TEXT,
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "profileUrl" TEXT,
ADD COLUMN     "snippet" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "valueBand" TEXT NOT NULL DEFAULT 'Low';

-- AlterTable
ALTER TABLE "token_ledger" DROP COLUMN "ref",
DROP COLUMN "tenantId",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "walletId" TEXT NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- DropEnum
DROP TYPE "LeadStage";

-- CreateTable
CREATE TABLE "token_wallets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "token_wallets_tenantId_key" ON "token_wallets"("tenantId");

-- AddForeignKey
ALTER TABLE "token_wallets" ADD CONSTRAINT "token_wallets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_ledger" ADD CONSTRAINT "token_ledger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "token_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
