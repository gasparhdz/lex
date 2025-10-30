-- CreateTable
CREATE TABLE "public"."ClienteNota" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "contenido" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "ClienteNota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClienteHistorial" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,

    CONSTRAINT "ClienteHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClienteNota_clienteId_idx" ON "public"."ClienteNota"("clienteId");

-- CreateIndex
CREATE INDEX "ClienteNota_createdAt_idx" ON "public"."ClienteNota"("createdAt");

-- CreateIndex
CREATE INDEX "ClienteHistorial_clienteId_idx" ON "public"."ClienteHistorial"("clienteId");

-- CreateIndex
CREATE INDEX "ClienteHistorial_createdAt_idx" ON "public"."ClienteHistorial"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."ClienteNota" ADD CONSTRAINT "ClienteNota_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClienteHistorial" ADD CONSTRAINT "ClienteHistorial_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
