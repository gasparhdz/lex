-- CreateTable
CREATE TABLE "public"."Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "mustChangePass" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Rol" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UsuarioRol" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "rolId" INTEGER NOT NULL,

    CONSTRAINT "UsuarioRol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Permiso" (
    "id" SERIAL NOT NULL,
    "rolId" INTEGER NOT NULL,
    "modulo" TEXT NOT NULL,
    "ver" BOOLEAN NOT NULL DEFAULT false,
    "crear" BOOLEAN NOT NULL DEFAULT false,
    "editar" BOOLEAN NOT NULL DEFAULT false,
    "eliminar" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RefreshToken" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Categoria" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Parametro" (
    "id" SERIAL NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parametro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Pais" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigoIso" TEXT,

    CONSTRAINT "Pais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Provincia" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "paisId" INTEGER NOT NULL,

    CONSTRAINT "Provincia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Localidad" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "provinciaId" INTEGER NOT NULL,

    CONSTRAINT "Localidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CodigoPostal" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "localidadId" INTEGER NOT NULL,

    CONSTRAINT "CodigoPostal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Cliente" (
    "id" SERIAL NOT NULL,
    "tipoPersonaId" INTEGER NOT NULL,
    "nombre" TEXT,
    "apellido" TEXT,
    "razonSocial" TEXT,
    "dni" TEXT,
    "cuit" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "email" TEXT,
    "telFijo" TEXT,
    "telCelular" TEXT,
    "dirCalle" TEXT,
    "dirNro" TEXT,
    "dirPiso" TEXT,
    "dirDepto" TEXT,
    "codigoPostal" TEXT,
    "localidadId" INTEGER,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContactoCliente" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "ContactoCliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_dni_key" ON "public"."Usuario"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "public"."Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Rol_codigo_key" ON "public"."Rol"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioRol_usuarioId_rolId_key" ON "public"."UsuarioRol"("usuarioId", "rolId");

-- CreateIndex
CREATE UNIQUE INDEX "Permiso_rolId_modulo_key" ON "public"."Permiso"("rolId", "modulo");

-- CreateIndex
CREATE INDEX "RefreshToken_usuarioId_expiresAt_idx" ON "public"."RefreshToken"("usuarioId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_codigo_key" ON "public"."Categoria"("codigo");

-- CreateIndex
CREATE INDEX "Parametro_categoriaId_activo_orden_idx" ON "public"."Parametro"("categoriaId", "activo", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "Parametro_categoriaId_codigo_key" ON "public"."Parametro"("categoriaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Pais_codigoIso_key" ON "public"."Pais"("codigoIso");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_dni_key" ON "public"."Cliente"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cuit_key" ON "public"."Cliente"("cuit");

-- AddForeignKey
ALTER TABLE "public"."UsuarioRol" ADD CONSTRAINT "UsuarioRol_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsuarioRol" ADD CONSTRAINT "UsuarioRol_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "public"."Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Permiso" ADD CONSTRAINT "Permiso_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "public"."Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefreshToken" ADD CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Parametro" ADD CONSTRAINT "Parametro_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Provincia" ADD CONSTRAINT "Provincia_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "public"."Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Localidad" ADD CONSTRAINT "Localidad_provinciaId_fkey" FOREIGN KEY ("provinciaId") REFERENCES "public"."Provincia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CodigoPostal" ADD CONSTRAINT "CodigoPostal_localidadId_fkey" FOREIGN KEY ("localidadId") REFERENCES "public"."Localidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cliente" ADD CONSTRAINT "Cliente_tipoPersonaId_fkey" FOREIGN KEY ("tipoPersonaId") REFERENCES "public"."Parametro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cliente" ADD CONSTRAINT "Cliente_localidadId_fkey" FOREIGN KEY ("localidadId") REFERENCES "public"."Localidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContactoCliente" ADD CONSTRAINT "ContactoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
