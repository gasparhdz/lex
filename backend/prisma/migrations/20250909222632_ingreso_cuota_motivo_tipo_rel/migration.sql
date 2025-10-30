-- AlterTable
ALTER TABLE "public"."IngresoCuota" ADD COLUMN     "ajusteDeId" INTEGER,
ADD COLUMN     "ajusteMotivoId" INTEGER,
ADD COLUMN     "motivo" TEXT,
ADD COLUMN     "nota" TEXT,
ADD COLUMN     "tipoMovimientoId" INTEGER;

-- CreateIndex
CREATE INDEX "IngresoCuota_tipoMovimientoId_idx" ON "public"."IngresoCuota"("tipoMovimientoId");

-- CreateIndex
CREATE INDEX "IngresoCuota_ajusteMotivoId_idx" ON "public"."IngresoCuota"("ajusteMotivoId");

-- CreateIndex
CREATE INDEX "IngresoCuota_ajusteDeId_idx" ON "public"."IngresoCuota"("ajusteDeId");

-- AddForeignKey
ALTER TABLE "public"."IngresoCuota" ADD CONSTRAINT "IngresoCuota_tipoMovimientoId_fkey" FOREIGN KEY ("tipoMovimientoId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IngresoCuota" ADD CONSTRAINT "IngresoCuota_ajusteMotivoId_fkey" FOREIGN KEY ("ajusteMotivoId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IngresoCuota" ADD CONSTRAINT "IngresoCuota_ajusteDeId_fkey" FOREIGN KEY ("ajusteDeId") REFERENCES "public"."IngresoCuota"("id") ON DELETE SET NULL ON UPDATE CASCADE;
