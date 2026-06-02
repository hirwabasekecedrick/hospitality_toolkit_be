-- AlterTable
ALTER TABLE "User" ADD COLUMN     "serviceProviderId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_serviceProviderId_fkey" FOREIGN KEY ("serviceProviderId") REFERENCES "ServiceProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
