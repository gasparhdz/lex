-- CreateTable
CREATE TABLE "public"."Evento" (
    "id" SERIAL NOT NULL,
    "casoId" INTEGER,
    "clienteId" INTEGER,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "tipoId" INTEGER NOT NULL,
    "estadoId" INTEGER,
    "descripcion" TEXT,
    "observaciones" TEXT,
    "recordatorio" TIMESTAMP(3),
    "recordatorioEnviado" BOOLEAN NOT NULL DEFAULT false,
    "notificadoACliente" BOOLEAN NOT NULL DEFAULT false,
    "ubicacion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tarea" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fechaLimite" TIMESTAMP(3),
    "prioridadId" INTEGER,
    "recordatorio" TIMESTAMP(3),
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "completadaAt" TIMESTAMP(3),
    "asignadoA" INTEGER,
    "clienteId" INTEGER,
    "casoId" INTEGER,
    "recordatorioEnviado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "Tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubTarea" (
    "id" SERIAL NOT NULL,
    "tareaId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "completadaAt" TIMESTAMP(3),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "SubTarea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evento_fechaInicio_idx" ON "public"."Evento"("fechaInicio");

-- CreateIndex
CREATE INDEX "Evento_recordatorio_recordatorioEnviado_idx" ON "public"."Evento"("recordatorio", "recordatorioEnviado");

-- CreateIndex
CREATE INDEX "Evento_clienteId_idx" ON "public"."Evento"("clienteId");

-- CreateIndex
CREATE INDEX "Evento_casoId_idx" ON "public"."Evento"("casoId");

-- CreateIndex
CREATE INDEX "Evento_tipoId_idx" ON "public"."Evento"("tipoId");

-- CreateIndex
CREATE INDEX "Evento_estadoId_idx" ON "public"."Evento"("estadoId");

-- CreateIndex
CREATE INDEX "Evento_createdBy_idx" ON "public"."Evento"("createdBy");

-- CreateIndex
CREATE INDEX "Tarea_completada_idx" ON "public"."Tarea"("completada");

-- CreateIndex
CREATE INDEX "Tarea_fechaLimite_idx" ON "public"."Tarea"("fechaLimite");

-- CreateIndex
CREATE INDEX "Tarea_recordatorio_recordatorioEnviado_idx" ON "public"."Tarea"("recordatorio", "recordatorioEnviado");

-- CreateIndex
CREATE INDEX "Tarea_prioridadId_idx" ON "public"."Tarea"("prioridadId");

-- CreateIndex
CREATE INDEX "Tarea_clienteId_idx" ON "public"."Tarea"("clienteId");

-- CreateIndex
CREATE INDEX "Tarea_casoId_idx" ON "public"."Tarea"("casoId");

-- CreateIndex
CREATE INDEX "Tarea_createdBy_idx" ON "public"."Tarea"("createdBy");

-- CreateIndex
CREATE INDEX "Tarea_asignadoA_idx" ON "public"."Tarea"("asignadoA");

-- CreateIndex
CREATE INDEX "SubTarea_tareaId_idx" ON "public"."SubTarea"("tareaId");

-- CreateIndex
CREATE INDEX "SubTarea_orden_idx" ON "public"."SubTarea"("orden");

-- AddForeignKey
ALTER TABLE "public"."Evento" ADD CONSTRAINT "Evento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Evento" ADD CONSTRAINT "Evento_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "public"."Caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Evento" ADD CONSTRAINT "Evento_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "public"."Parametro"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Evento" ADD CONSTRAINT "Evento_estadoId_fkey" FOREIGN KEY ("estadoId") REFERENCES "public"."Parametro"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Tarea" ADD CONSTRAINT "Tarea_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Tarea" ADD CONSTRAINT "Tarea_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "public"."Caso"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Tarea" ADD CONSTRAINT "Tarea_prioridadId_fkey" FOREIGN KEY ("prioridadId") REFERENCES "public"."Parametro"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Tarea" ADD CONSTRAINT "Tarea_asignadoA_fkey" FOREIGN KEY ("asignadoA") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubTarea" ADD CONSTRAINT "SubTarea_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "public"."Tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
