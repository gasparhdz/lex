/*
  Warnings:

  - You are about to drop the column `politicaJusId` on the `Honorario` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Honorario" DROP CONSTRAINT "Honorario_politicaJusId_fkey";

-- AlterTable
ALTER TABLE "public"."Honorario" DROP COLUMN "politicaJusId";

-- AlterTable
ALTER TABLE "public"."PlanPago" ADD COLUMN     "politicaJusId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."PlanPago" ADD CONSTRAINT "PlanPago_politicaJusId_fkey" FOREIGN KEY ("politicaJusId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
