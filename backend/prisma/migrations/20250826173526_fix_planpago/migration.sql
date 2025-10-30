-- CreateTable
CREATE TABLE "public"."PlanPago" (
    "id" SERIAL NOT NULL,
    "honorarioId" INTEGER NOT NULL,
    "clienteId" INTEGER,
    "casoId" INTEGER,
    "descripcion" TEXT,
    "fechaInicio" TIMESTAMP(3),
    "periodicidadId" INTEGER,
    "montoCuotaJus" DECIMAL(14,4),
    "montoCuotaPesos" DECIMAL(14,2),
    "valorJusRef" DECIMAL(14,4),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "PlanPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlanCuota" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "vencimiento" TIMESTAMP(3) NOT NULL,
    "montoJus" DECIMAL(14,4),
    "montoPesos" DECIMAL(14,2),
    "valorJusRef" DECIMAL(14,4),
    "estadoId" INTEGER,
    "observacion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "PlanCuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanPago_honorarioId_idx" ON "public"."PlanPago"("honorarioId");

-- CreateIndex
CREATE INDEX "PlanPago_clienteId_idx" ON "public"."PlanPago"("clienteId");

-- CreateIndex
CREATE INDEX "PlanPago_casoId_idx" ON "public"."PlanPago"("casoId");

-- CreateIndex
CREATE INDEX "PlanCuota_planId_idx" ON "public"."PlanCuota"("planId");

-- CreateIndex
CREATE INDEX "PlanCuota_vencimiento_idx" ON "public"."PlanCuota"("vencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "PlanCuota_planId_numero_key" ON "public"."PlanCuota"("planId", "numero");

-- AddForeignKey
ALTER TABLE "public"."PlanPago" ADD CONSTRAINT "PlanPago_honorarioId_fkey" FOREIGN KEY ("honorarioId") REFERENCES "public"."Honorario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlanPago" ADD CONSTRAINT "PlanPago_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlanPago" ADD CONSTRAINT "PlanPago_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "public"."Caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlanPago" ADD CONSTRAINT "PlanPago_periodicidadId_fkey" FOREIGN KEY ("periodicidadId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlanCuota" ADD CONSTRAINT "PlanCuota_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."PlanPago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
