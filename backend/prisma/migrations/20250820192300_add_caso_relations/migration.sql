-- CreateTable
CREATE TABLE "public"."Caso" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "nroExpte" TEXT NOT NULL,
    "nroExpteNorm" TEXT,
    "caratula" TEXT NOT NULL,
    "tipoId" INTEGER NOT NULL,
    "descripcion" TEXT,
    "estadoId" INTEGER,
    "fechaEstado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "radicacionId" INTEGER,
    "estadoRadicacionId" INTEGER,
    "fechaEstadoRadicacion" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "Caso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Caso_clienteId_idx" ON "public"."Caso"("clienteId");

-- CreateIndex
CREATE INDEX "Caso_estadoId_fechaEstado_idx" ON "public"."Caso"("estadoId", "fechaEstado");

-- CreateIndex
CREATE INDEX "Caso_radicacionId_estadoRadicacionId_idx" ON "public"."Caso"("radicacionId", "estadoRadicacionId");

-- CreateIndex
CREATE INDEX "Caso_tipoId_idx" ON "public"."Caso"("tipoId");

-- CreateIndex
CREATE INDEX "Caso_nroExpte_idx" ON "public"."Caso"("nroExpte");

-- AddForeignKey
ALTER TABLE "public"."Caso" ADD CONSTRAINT "Caso_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Caso" ADD CONSTRAINT "Caso_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "public"."Parametro"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Caso" ADD CONSTRAINT "Caso_estadoId_fkey" FOREIGN KEY ("estadoId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Caso" ADD CONSTRAINT "Caso_radicacionId_fkey" FOREIGN KEY ("radicacionId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Caso" ADD CONSTRAINT "Caso_estadoRadicacionId_fkey" FOREIGN KEY ("estadoRadicacionId") REFERENCES "public"."Parametro"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
