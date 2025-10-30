-- CreateEnum
CREATE TYPE "public"."AdjuntoScope" AS ENUM ('CLIENTE', 'CASO');

-- AlterTable
ALTER TABLE "public"."Caso" ADD COLUMN     "driveFolderId" TEXT,
ADD COLUMN     "numeroDrive" INTEGER;

-- AlterTable
ALTER TABLE "public"."Cliente" ADD COLUMN     "driveFolderId" TEXT;

-- CreateTable
CREATE TABLE "public"."Adjunto" (
    "id" SERIAL NOT NULL,
    "scope" "public"."AdjuntoScope" NOT NULL,
    "scopeId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "driveFileId" TEXT NOT NULL,
    "driveFolderId" TEXT NOT NULL,
    "driveWebView" TEXT,
    "driveWebContent" TEXT,
    "subidoPorId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminadoEn" TIMESTAMP(3),

    CONSTRAINT "Adjunto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Adjunto_driveFileId_key" ON "public"."Adjunto"("driveFileId");

-- CreateIndex
CREATE INDEX "Adjunto_scope_scopeId_creadoEn_idx" ON "public"."Adjunto"("scope", "scopeId", "creadoEn");

-- CreateIndex
CREATE INDEX "Adjunto_subidoPorId_idx" ON "public"."Adjunto"("subidoPorId");

-- CreateIndex
CREATE INDEX "Adjunto_driveFileId_idx" ON "public"."Adjunto"("driveFileId");

-- AddForeignKey
ALTER TABLE "public"."Adjunto" ADD CONSTRAINT "Adjunto_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
