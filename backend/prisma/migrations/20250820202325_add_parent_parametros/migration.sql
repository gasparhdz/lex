-- AlterTable
ALTER TABLE "public"."Parametro" ADD COLUMN     "parentId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Parametro" ADD CONSTRAINT "Parametro_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
