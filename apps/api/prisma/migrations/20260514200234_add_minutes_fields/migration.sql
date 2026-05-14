-- AlterTable
ALTER TABLE "meeting_minutes" ADD COLUMN     "keyPoints" JSONB,
ADD COLUMN     "nextSteps" TEXT,
ADD COLUMN     "sentiment" TEXT;
