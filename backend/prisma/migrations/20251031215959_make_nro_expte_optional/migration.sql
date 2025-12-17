/*
  Warnings:

  - Made the column `caratula` on table `Caso` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Caso" ALTER COLUMN "caratula" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Honorario" ADD COLUMN     "politicaJusId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Honorario" ADD CONSTRAINT "Honorario_politicaJusId_fkey" FOREIGN KEY ("politicaJusId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
