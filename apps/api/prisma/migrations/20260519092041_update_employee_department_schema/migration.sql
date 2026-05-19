/*
  Warnings:

  - You are about to drop the column `joinedAt` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `salary` on the `employees` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `departments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `employees` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `employees` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "description" TEXT,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- AlterTable
ALTER TABLE "employees" DROP COLUMN "joinedAt",
DROP COLUMN "salary",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "basicSalary" DOUBLE PRECISION,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "designation" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "emergencyPhone" TEXT,
ADD COLUMN     "emergencyRelation" TEXT,
ADD COLUMN     "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
ADD COLUMN     "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "houseAllowance" DOUBLE PRECISION,
ADD COLUMN     "jobRole" TEXT,
ADD COLUMN     "joinDate" TIMESTAMP(3),
ADD COLUMN     "lastName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "medicalAllowance" DOUBLE PRECISION,
ADD COLUMN     "nationalId" TEXT,
ADD COLUMN     "otherAllowance" DOUBLE PRECISION,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "reportingToId" TEXT,
ADD COLUMN     "transportAllowance" DOUBLE PRECISION,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "departments_tenantId_idx" ON "departments"("tenantId");

-- CreateIndex
CREATE INDEX "employees_tenantId_idx" ON "employees"("tenantId");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_reportingToId_fkey" FOREIGN KEY ("reportingToId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
