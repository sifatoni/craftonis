-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "departmentId" TEXT;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
