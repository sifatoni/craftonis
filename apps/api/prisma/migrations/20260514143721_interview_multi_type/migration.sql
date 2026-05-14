/*
  Warnings:

  - You are about to drop the column `type` on the `interviews` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "interviews" DROP COLUMN "type",
ADD COLUMN     "types" JSONB NOT NULL DEFAULT '[]';
