-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "interviews" ADD COLUMN     "jobId" TEXT;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
