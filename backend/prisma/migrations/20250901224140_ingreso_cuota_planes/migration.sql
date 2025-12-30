/*
  Warnings:

  - You are about to drop the `IngresoHonorario` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Caso" DROP CONSTRAINT "Caso_estadoRadicacionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."IngresoHonorario" DROP CONSTRAINT "IngresoHonorario_honorarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."IngresoHonorario" DROP CONSTRAINT "IngresoHonorario_ingresoId_fkey";

-- DropTable
DROP TABLE "public"."IngresoHonorario";

-- CreateTable
CREATE TABLE "public"."IngresoCuota" (
    "id" SERIAL NOT NULL,
    "ingresoId" INTEGER NOT NULL,
    "cuotaId" INTEGER NOT NULL,
    "fechaAplicacion" TIMESTAMP(3) NOT NULL,
    "montoAplicadoARS" DECIMAL(14,2) NOT NULL,
    "valorJusAlAplic" DECIMAL(14,4),
    "montoAplicadoJUS" DECIMAL(14,4),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "IngresoCuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngresoCuota_ingresoId_idx" ON "public"."IngresoCuota"("ingresoId");

-- CreateIndex
CREATE INDEX "IngresoCuota_cuotaId_idx" ON "public"."IngresoCuota"("cuotaId");

-- CreateIndex
CREATE INDEX "PlanCuota_estadoId_idx" ON "public"."PlanCuota"("estadoId");

-- AddForeignKey
ALTER TABLE "public"."Caso" ADD CONSTRAINT "Caso_estadoRadicacionId_fkey" FOREIGN KEY ("estadoRadicacionId") REFERENCES "public"."Parametro"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PlanCuota" ADD CONSTRAINT "PlanCuota_estadoId_fkey" FOREIGN KEY ("estadoId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IngresoCuota" ADD CONSTRAINT "IngresoCuota_ingresoId_fkey" FOREIGN KEY ("ingresoId") REFERENCES "public"."Ingreso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IngresoCuota" ADD CONSTRAINT "IngresoCuota_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "public"."PlanCuota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
