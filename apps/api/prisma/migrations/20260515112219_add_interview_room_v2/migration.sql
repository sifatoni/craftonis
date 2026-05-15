/*
  Warnings:

  - You are about to drop the column `codeSubmitted` on the `interview_rooms` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "interview_rooms" DROP CONSTRAINT "interview_rooms_interviewId_fkey";

-- AlterTable
ALTER TABLE "interview_rooms" DROP COLUMN "codeSubmitted",
ADD COLUMN     "codeContent" TEXT DEFAULT '',
ADD COLUMN     "codeLanguage" TEXT DEFAULT 'javascript';

-- AddForeignKey
ALTER TABLE "interview_rooms" ADD CONSTRAINT "interview_rooms_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
