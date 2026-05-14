-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "meetingType" TEXT,
ADD COLUMN     "participants" JSONB,
ADD COLUMN     "scheduledFor" TIMESTAMP(3);
