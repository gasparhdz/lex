-- CreateTable
CREATE TABLE "public"."ValorJUS" (
    "id" SERIAL NOT NULL,
    "valor" DECIMAL(14,4) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "ValorJUS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Honorario" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER,
    "casoId" INTEGER,
    "conceptoId" INTEGER NOT NULL,
    "parteId" INTEGER NOT NULL,
    "jus" DECIMAL(14,4),
    "montoPesos" DECIMAL(14,2),
    "monedaId" INTEGER,
    "valorJusRef" DECIMAL(14,4),
    "politicaJusId" INTEGER,
    "fechaRegulacion" TIMESTAMP(3) NOT NULL,
    "estadoId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "Honorario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Gasto" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "casoId" INTEGER,
    "conceptoId" INTEGER,
    "descripcion" TEXT,
    "fechaGasto" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "monedaId" INTEGER,
    "cotizacionARS" DECIMAL(14,4),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ingreso" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER,
    "casoId" INTEGER,
    "descripcion" TEXT,
    "monto" DECIMAL(14,2) NOT NULL,
    "monedaId" INTEGER,
    "cotizacionARS" DECIMAL(14,4),
    "fechaIngreso" TIMESTAMP(3) NOT NULL,
    "valorJusAlCobro" DECIMAL(14,4),
    "montoJusEquivalente" DECIMAL(14,4),
    "montoPesosEquivalente" DECIMAL(14,2),
    "tipoId" INTEGER,
    "estadoId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "Ingreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IngresoHonorario" (
    "id" SERIAL NOT NULL,
    "ingresoId" INTEGER NOT NULL,
    "honorarioId" INTEGER NOT NULL,
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

    CONSTRAINT "IngresoHonorario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IngresoGasto" (
    "id" SERIAL NOT NULL,
    "ingresoId" INTEGER NOT NULL,
    "gastoId" INTEGER NOT NULL,
    "fechaAplicacion" TIMESTAMP(3) NOT NULL,
    "montoAplicadoARS" DECIMAL(14,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "IngresoGasto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ValorJUS_fecha_key" ON "public"."ValorJUS"("fecha");

-- CreateIndex
CREATE INDEX "Honorario_clienteId_idx" ON "public"."Honorario"("clienteId");

-- CreateIndex
CREATE INDEX "Honorario_casoId_idx" ON "public"."Honorario"("casoId");

-- CreateIndex
CREATE INDEX "Honorario_estadoId_idx" ON "public"."Honorario"("estadoId");

-- CreateIndex
CREATE INDEX "Gasto_clienteId_idx" ON "public"."Gasto"("clienteId");

-- CreateIndex
CREATE INDEX "Gasto_casoId_fechaGasto_idx" ON "public"."Gasto"("casoId", "fechaGasto");

-- CreateIndex
CREATE INDEX "Ingreso_fechaIngreso_idx" ON "public"."Ingreso"("fechaIngreso");

-- CreateIndex
CREATE INDEX "Ingreso_clienteId_idx" ON "public"."Ingreso"("clienteId");

-- CreateIndex
CREATE INDEX "Ingreso_casoId_idx" ON "public"."Ingreso"("casoId");

-- CreateIndex
CREATE INDEX "IngresoHonorario_honorarioId_idx" ON "public"."IngresoHonorario"("honorarioId");

-- CreateIndex
CREATE INDEX "IngresoHonorario_ingresoId_idx" ON "public"."IngresoHonorario"("ingresoId");

-- CreateIndex
CREATE INDEX "IngresoGasto_gastoId_idx" ON "public"."IngresoGasto"("gastoId");

-- CreateIndex
CREATE INDEX "IngresoGasto_ingresoId_idx" ON "public"."IngresoGasto"("ingresoId");

-- AddForeignKey
ALTER TABLE "public"."Honorario" ADD CONSTRAINT "Honorario_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Honorario" ADD CONSTRAINT "Honorario_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "public"."Caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Honorario" ADD CONSTRAINT "Honorario_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "public"."Parametro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Honorario" ADD CONSTRAINT "Honorario_parteId_fkey" FOREIGN KEY ("parteId") REFERENCES "public"."Parametro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Honorario" ADD CONSTRAINT "Honorario_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Honorario" ADD CONSTRAINT "Honorario_politicaJusId_fkey" FOREIGN KEY ("politicaJusId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Honorario" ADD CONSTRAINT "Honorario_estadoId_fkey" FOREIGN KEY ("estadoId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Gasto" ADD CONSTRAINT "Gasto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Gasto" ADD CONSTRAINT "Gasto_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "public"."Caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Gasto" ADD CONSTRAINT "Gasto_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Gasto" ADD CONSTRAINT "Gasto_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ingreso" ADD CONSTRAINT "Ingreso_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ingreso" ADD CONSTRAINT "Ingreso_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "public"."Caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ingreso" ADD CONSTRAINT "Ingreso_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ingreso" ADD CONSTRAINT "Ingreso_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ingreso" ADD CONSTRAINT "Ingreso_estadoId_fkey" FOREIGN KEY ("estadoId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IngresoHonorario" ADD CONSTRAINT "IngresoHonorario_ingresoId_fkey" FOREIGN KEY ("ingresoId") REFERENCES "public"."Ingreso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IngresoHonorario" ADD CONSTRAINT "IngresoHonorario_honorarioId_fkey" FOREIGN KEY ("honorarioId") REFERENCES "public"."Honorario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IngresoGasto" ADD CONSTRAINT "IngresoGasto_ingresoId_fkey" FOREIGN KEY ("ingresoId") REFERENCES "public"."Ingreso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IngresoGasto" ADD CONSTRAINT "IngresoGasto_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "public"."Gasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
