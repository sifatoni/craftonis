/*
  Warnings:

  - You are about to drop the column `approvedBy` on the `leave_requests` table. All the data in the column will be lost.
  - You are about to drop the column `fromDate` on the `leave_requests` table. All the data in the column will be lost.
  - You are about to drop the column `toDate` on the `leave_requests` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `leave_requests` table. All the data in the column will be lost.
  - You are about to drop the `attendance` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `endDate` to the `leave_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `leaveType` to the `leave_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `leave_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `leave_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalDays` to the `leave_requests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttendanceStatus" ADD VALUE 'HALF_DAY';
ALTER TYPE "AttendanceStatus" ADD VALUE 'LEAVE';
ALTER TYPE "AttendanceStatus" ADD VALUE 'HOLIDAY';

-- AlterEnum
ALTER TYPE "LeaveStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "LeaveType" ADD VALUE 'CASUAL';

-- DropForeignKey
ALTER TABLE "attendance" DROP CONSTRAINT "attendance_employeeId_fkey";

-- AlterTable
ALTER TABLE "leave_requests" DROP COLUMN "approvedBy",
DROP COLUMN "fromDate",
DROP COLUMN "toDate",
DROP COLUMN "type",
ADD COLUMN     "approverComment" TEXT,
ADD COLUMN     "approverId" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "leaveType" "LeaveType" NOT NULL,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "tenantId" TEXT NOT NULL,
ADD COLUMN     "totalDays" INTEGER NOT NULL;

-- DropTable
DROP TABLE "attendance";

-- CreateTable
CREATE TABLE "attendance_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "checkinTime" TIMESTAMP(3),
    "checkoutTime" TIMESTAMP(3),
    "hoursWorked" DOUBLE PRECISION,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_logs_tenantId_idx" ON "attendance_logs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_logs_employeeId_date_key" ON "attendance_logs"("employeeId", "date");

-- CreateIndex
CREATE INDEX "leave_requests_tenantId_idx" ON "leave_requests"("tenantId");

-- AddForeignKey
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
