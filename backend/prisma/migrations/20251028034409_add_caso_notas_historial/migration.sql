-- CreateTable
CREATE TABLE "public"."CasoNota" (
    "id" SERIAL NOT NULL,
    "casoId" INTEGER NOT NULL,
    "contenido" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "CasoNota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CasoHistorial" (
    "id" SERIAL NOT NULL,
    "casoId" INTEGER NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,

    CONSTRAINT "CasoHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CasoNota_casoId_idx" ON "public"."CasoNota"("casoId");

-- CreateIndex
CREATE INDEX "CasoNota_createdAt_idx" ON "public"."CasoNota"("createdAt");

-- CreateIndex
CREATE INDEX "CasoHistorial_casoId_idx" ON "public"."CasoHistorial"("casoId");

-- CreateIndex
CREATE INDEX "CasoHistorial_createdAt_idx" ON "public"."CasoHistorial"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."CasoNota" ADD CONSTRAINT "CasoNota_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "public"."Caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CasoHistorial" ADD CONSTRAINT "CasoHistorial_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "public"."Caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
