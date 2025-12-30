import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function ensureParam(categoriaId, codigo, nombre, orden, parentId = null) {
  const existing = await prisma.parametro.findFirst({
    where: { categoriaId, codigo }
  });
  if (!existing) {
    return await prisma.parametro.create({
      data: { categoriaId, codigo, nombre, orden, parentId, activo: true }
    });
  }
  return existing;
}

async function main() {
  console.log('⚙️ Iniciando seed de parámetros...');

  // ========== CATEGORÍA 1: RAMA_DERECHO ==========
  const catRamaDerecho = await prisma.categoria.findFirst({
    where: { codigo: 'RAMA_DERECHO' }
  });

  if (!catRamaDerecho) {
    console.error('❌ Categoría RAMA_DERECHO no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catRamaDerecho.nombre} (ID: ${catRamaDerecho.id})...`);
  
  const ramaAdmin = await ensureParam(catRamaDerecho.id, 'ADMINISTRATIVO', 'Administrativo', 1);
  const ramaCircuito = await ensureParam(catRamaDerecho.id, 'CIRCUITO', 'Circuito', 2);
  const ramaCivil = await ensureParam(catRamaDerecho.id, 'CIVIL_COMERCIAL', 'Civil y Comercial', 3);
  const ramaFamilia = await ensureParam(catRamaDerecho.id, 'FAMILIA', 'Familia', 4);
  const ramaLaboral = await ensureParam(catRamaDerecho.id, 'LABORAL', 'Laboral', 5);
  const ramaPenal = await ensureParam(catRamaDerecho.id, 'PENAL', 'Penal', 6);
  const ramaPrevisional = await ensureParam(catRamaDerecho.id, 'PREVISIONAL', 'Previsional', 7);
  const ramaSucesiones = await ensureParam(catRamaDerecho.id, 'SUCESIONES', 'Sucesiones', 8);

  console.log(`✅ 8 parámetros de RAMA_DERECHO creados`);

  // ========== CATEGORÍA 2: TIPO_CASO ==========
  const catTipoCaso = await prisma.categoria.findFirst({
    where: { codigo: 'TIPO_CASO' }
  });

  if (!catTipoCaso) {
    console.error('❌ Categoría TIPO_CASO no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catTipoCaso.nombre} (ID: ${catTipoCaso.id})...`);

  // Parámetros con parentId = FAMILIA
  await ensureParam(catTipoCaso.id, 'ADOPCION', 'Adopción', 1, ramaFamilia.id);
  await ensureParam(catTipoCaso.id, 'ALIMENTOS', 'Alimentos', 2, ramaFamilia.id);
  await ensureParam(catTipoCaso.id, 'DIVORCIO', 'Divorcio', 3, ramaFamilia.id);
  await ensureParam(catTipoCaso.id, 'FILIACION', 'Filiación', 4, ramaFamilia.id);
  await ensureParam(catTipoCaso.id, 'REGIMEN_DE_VISITAS', 'Régimen de visitas', 5, ramaFamilia.id);
  await ensureParam(catTipoCaso.id, 'TENENCIA_CUIDADO_PERSONAL', 'Tenencia / cuidado personal', 6, ramaFamilia.id);

  // Parámetros con parentId = CIVIL_COMERCIAL
  await ensureParam(catTipoCaso.id, 'COBRO_EJECUTIVO', 'Cobro ejecutivo', 7, ramaCivil.id);
  await ensureParam(catTipoCaso.id, 'CONCURSO_PREVENTIVO', 'Concurso preventivo', 8, ramaCivil.id);
  await ensureParam(catTipoCaso.id, 'DAÑOS_Y_PERJUICIOS', 'Daños y perjuicios', 9, ramaCivil.id);
  await ensureParam(catTipoCaso.id, 'DESALOJO', 'Desalojo', 10, ramaCivil.id);
  await ensureParam(catTipoCaso.id, 'INCUMPLIMIENTO_CONTRACTUAL', 'Incumplimiento contractual', 11, ramaCivil.id);
  await ensureParam(catTipoCaso.id, 'JUICIO_EJECUTIVO', 'Juicio ejecutivo', 12, ramaCivil.id);
  await ensureParam(catTipoCaso.id, 'JUICIO_ORDINARIO_COMERCIAL', 'Juicio ordinario comercial', 13, ramaCivil.id);
  await ensureParam(catTipoCaso.id, 'QUIEBRA', 'Quiebra', 14, ramaCivil.id);
  await ensureParam(catTipoCaso.id, 'REIVINDICACION', 'Reivindicación', 15, ramaCivil.id);
  await ensureParam(catTipoCaso.id, 'RESPONSABILIDAD_CIVIL', 'Responsabilidad civil', 16, ramaCivil.id);
  await ensureParam(catTipoCaso.id, 'USUCAPION', 'Usucapión', 17, ramaCivil.id);

  // Parámetros con parentId = LABORAL
  await ensureParam(catTipoCaso.id, 'ACCIDENTE_DE_TRABAJO', 'Accidente de trabajo', 18, ramaLaboral.id);
  await ensureParam(catTipoCaso.id, 'DESPIDO', 'Despido', 19, ramaLaboral.id);
  await ensureParam(catTipoCaso.id, 'DIFERENCIAS_SALARIALES', 'Diferencias salariales', 20, ramaLaboral.id);
  await ensureParam(catTipoCaso.id, 'REINSTALACION', 'Reinstalación', 21, ramaLaboral.id);
  await ensureParam(catTipoCaso.id, 'TRABAJO_NO_REGISTRADO', 'Trabajo no registrado', 22, ramaLaboral.id);

  // Parámetros con parentId = PENAL
  await ensureParam(catTipoCaso.id, 'ABUSO_SEXUAL', 'Abuso sexual', 23, ramaPenal.id);
  await ensureParam(catTipoCaso.id, 'ESTAFA', 'Estafa', 24, ramaPenal.id);
  await ensureParam(catTipoCaso.id, 'HURTO_ROBO', 'Hurto / Robo', 25, ramaPenal.id);
  await ensureParam(catTipoCaso.id, 'LESIONES', 'Lesiones', 26, ramaPenal.id);
  await ensureParam(catTipoCaso.id, 'VIOLENCIA_DE_GENERO', 'Violencia de género', 27, ramaPenal.id);

  // Parámetros con parentId = SUCESIONES
  await ensureParam(catTipoCaso.id, 'SUCESION_SIMPLE', 'Sucesión simple', 28, ramaSucesiones.id);
  await ensureParam(catTipoCaso.id, 'SUCESION_TESTAMENTARIA', 'Sucesión testamentaria', 29, ramaSucesiones.id);

  // Parámetros con parentId = ADMINISTRATIVO
  await ensureParam(catTipoCaso.id, 'AMPARO', 'Amparo', 30, ramaAdmin.id);
  await ensureParam(catTipoCaso.id, 'HABEAS_CORPUS', 'Habeas corpus', 31, ramaAdmin.id);
  await ensureParam(catTipoCaso.id, 'HABEAS_DATA', 'Habeas data', 32, ramaAdmin.id);
  await ensureParam(catTipoCaso.id, 'RECURSO_DE_RECONSIDERACION', 'Recurso de reconsideración', 33, ramaAdmin.id);

  // Parámetros con parentId = PREVISIONAL
  await ensureParam(catTipoCaso.id, 'JUBILACION', 'Jubilación', 34, ramaPrevisional.id);
  await ensureParam(catTipoCaso.id, 'PENSION', 'Pensión', 35, ramaPrevisional.id);
  await ensureParam(catTipoCaso.id, 'REAJUSTE', 'Reajuste', 36, ramaPrevisional.id);

  // Parámetros con parentId = CIRCUITO
  await ensureParam(catTipoCaso.id, 'DAÑOS_Y_PERJUICIOS_DESALOJO', 'Daños y perjuicios', 37, ramaCircuito.id);
  await ensureParam(catTipoCaso.id, 'DESALOJO_RADICACION', 'Desalojo', 38, ramaCircuito.id);
  await ensureParam(catTipoCaso.id, 'INSCRIPCION_DE_SUBASTA', 'Inscripción de subasta', 39, ramaCircuito.id);
  await ensureParam(catTipoCaso.id, 'PRESCRIPCION_ADQUISITIVA', 'Prescripción adquisitiva', 40, ramaCircuito.id);

  console.log(`✅ 34 parámetros de TIPO_CASO creados`);

  // ========== CATEGORÍA 3: ESTADO_CASO ==========
  const catEstadoCaso = await prisma.categoria.findFirst({
    where: { codigo: 'ESTADO_CASO' }
  });

  if (!catEstadoCaso) {
    console.error('❌ Categoría ESTADO_CASO no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catEstadoCaso.nombre} (ID: ${catEstadoCaso.id})...`);
  
  await ensureParam(catEstadoCaso.id, 'APELADO', 'Apelado', 1);
  await ensureParam(catEstadoCaso.id, 'ARCHIVADO', 'Archivado', 2);
  await ensureParam(catEstadoCaso.id, 'CON_RESOLUCION_FIRME', 'Con resolución firme', 3);
  await ensureParam(catEstadoCaso.id, 'CON_SENTENCIA', 'Con sentencia', 4);
  await ensureParam(catEstadoCaso.id, 'EJECUTANDO_SENTENCIA', 'Ejecutando sentencia', 5);
  await ensureParam(catEstadoCaso.id, 'EN_ESTUDIO', 'En estudio', 6);
  await ensureParam(catEstadoCaso.id, 'EN_TRAMITE', 'En trámite', 7);
  await ensureParam(catEstadoCaso.id, 'FINALIZADO', 'Finalizado', 8);

  console.log(`✅ 8 parámetros de ESTADO_CASO creados`);

  // ========== CATEGORÍA 4: ESTADO_RADICACION ==========
  const catEstadoRadicacion = await prisma.categoria.findFirst({
    where: { codigo: 'ESTADO_RADICACION' }
  });

  if (!catEstadoRadicacion) {
    console.error('❌ Categoría ESTADO_RADICACION no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catEstadoRadicacion.nombre} (ID: ${catEstadoRadicacion.id})...`);
  
  await ensureParam(catEstadoRadicacion.id, 'ARCHIVADO_POR_JUZGADO', 'Archivado por juzgado', 1);
  await ensureParam(catEstadoRadicacion.id, 'CERRADO_POR_RESOLUCION', 'Cerrado por resolución', 2);
  await ensureParam(catEstadoRadicacion.id, 'CON_COMPETENCIA_DECLINADA', 'Con competencia declinada', 3);
  await ensureParam(catEstadoRadicacion.id, 'EN_CAMARA', 'En cámara', 4);
  await ensureParam(catEstadoRadicacion.id, 'PENDIENTE_DE_SORTEO', 'Pendiente de sorteo', 5);
  await ensureParam(catEstadoRadicacion.id, 'RADICADO_EN_JUZGADO', 'Radicado en juzgado', 6);
  await ensureParam(catEstadoRadicacion.id, 'REMITIDO_A_OTRA_JURISDICCION', 'Remitido a otra jurisdicción', 7);

  console.log(`✅ 7 parámetros de ESTADO_RADICACION creados`);

  // ========== CATEGORÍA 5: TIPO_EVENTO ==========
  const catTipoEvento = await prisma.categoria.findFirst({
    where: { codigo: 'TIPO_EVENTO' }
  });

  if (!catTipoEvento) {
    console.error('❌ Categoría TIPO_EVENTO no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catTipoEvento.nombre} (ID: ${catTipoEvento.id})...`);
  
  await ensureParam(catTipoEvento.id, 'APELACION', 'Apelación', 1);
  await ensureParam(catTipoEvento.id, 'ARCHIVO_DEL_EXPEDIENTE', 'Archivo del expediente', 2);
  await ensureParam(catTipoEvento.id, 'AUDIENCIA', 'Audiencia', 3);
  await ensureParam(catTipoEvento.id, 'NOTIFICACION', 'Notificación', 4);
  await ensureParam(catTipoEvento.id, 'OFRECIMIENTO_DE_PRUEBA', 'Ofrecimiento de prueba', 5);
  await ensureParam(catTipoEvento.id, 'OTRO', 'Otro', 6);
  await ensureParam(catTipoEvento.id, 'PAGO', 'Pago', 7);
  await ensureParam(catTipoEvento.id, 'PRESENTACION_DE_ESCRITO', 'Presentación de escrito', 8);
  await ensureParam(catTipoEvento.id, 'PRODUCCION_DE_PRUEBA', 'Producción de prueba', 9);
  await ensureParam(catTipoEvento.id, 'SENTENCIA', 'Sentencia', 10);
  await ensureParam(catTipoEvento.id, 'VENCIMIENTO', 'Vencimiento', 11);
  await ensureParam(catTipoEvento.id, 'VISTA_AL_ACTOR_DEMANDADO', 'Vista al actor/demandado', 12);

  console.log(`✅ 12 parámetros de TIPO_EVENTO creados`);

  // ========== CATEGORÍA 6: ESTADO_EVENTO ==========
  const catEstadoEvento = await prisma.categoria.findFirst({
    where: { codigo: 'ESTADO_EVENTO' }
  });

  if (!catEstadoEvento) {
    console.error('❌ Categoría ESTADO_EVENTO no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catEstadoEvento.nombre} (ID: ${catEstadoEvento.id})...`);
  
  await ensureParam(catEstadoEvento.id, 'CANCELADO', 'Cancelado', 1);
  await ensureParam(catEstadoEvento.id, 'EN_SEGUIMIENTO', 'En seguimiento', 2);
  await ensureParam(catEstadoEvento.id, 'INCUMPLIDO', 'Incumplido', 3);
  await ensureParam(catEstadoEvento.id, 'PENDIENTE', 'Pendiente', 4);
  await ensureParam(catEstadoEvento.id, 'REALIZADO', 'Realizado', 5);
  await ensureParam(catEstadoEvento.id, 'REPROGRAMADO', 'Reprogramado', 6);

  console.log(`✅ 6 parámetros de ESTADO_EVENTO creados`);

  // ========== CATEGORÍA 7: PRIORIDAD ==========
  const catPrioridad = await prisma.categoria.findFirst({
    where: { codigo: 'PRIORIDAD' }
  });

  if (!catPrioridad) {
    console.error('❌ Categoría PRIORIDAD no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catPrioridad.nombre} (ID: ${catPrioridad.id})...`);
  
  await ensureParam(catPrioridad.id, 'ALTA', 'Alta', 1);
  await ensureParam(catPrioridad.id, 'BAJA', 'Baja', 2);
  await ensureParam(catPrioridad.id, 'CRITICA', 'Crítica', 3);
  await ensureParam(catPrioridad.id, 'MEDIA', 'Media', 4);
  await ensureParam(catPrioridad.id, 'SIN_PRIORIDAD', 'Sin prioridad', 5);

  console.log(`✅ 5 parámetros de PRIORIDAD creados`);

  // ========== CATEGORÍA 9: LOCALIDAD_RADICACION (crear primero porque RADICACION la necesita) ==========
  const catLocalidadRadicacion = await prisma.categoria.findFirst({
    where: { codigo: 'LOCALIDAD_RADICACION' }
  });

  if (!catLocalidadRadicacion) {
    console.error('❌ Categoría LOCALIDAD_RADICACION no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catLocalidadRadicacion.nombre} (ID: ${catLocalidadRadicacion.id})...`);
  
  const rosario = await ensureParam(catLocalidadRadicacion.id, 'ROSARIO', 'Rosario', 1);
  const sanLorenzo = await ensureParam(catLocalidadRadicacion.id, 'SAN_LORENZO', 'San Lorenzo', 2);
  const santaFe = await ensureParam(catLocalidadRadicacion.id, 'SANTA_FE', 'Santa Fé', 3);
  const canadaGomez = await ensureParam(catLocalidadRadicacion.id, 'CAÑADA_DE_GOMEZ', 'Cañada de Gomez', 4);

  console.log(`✅ 4 parámetros de LOCALIDAD_RADICACION creados`);

  // ========== CATEGORÍA 8: RADICACION ==========
  const catRadicacion = await prisma.categoria.findFirst({
    where: { codigo: 'RADICACION' }
  });

  if (!catRadicacion) {
    console.error('❌ Categoría RADICACION no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catRadicacion.nombre} (ID: ${catRadicacion.id})...`);

  let orden = 1;

  // ROSARIO - todos con parentId = rosario.id
  await ensureParam(catRadicacion.id, 'JUZGADO_CIVIL_Y_COMERCIAL_N1_ROS', 'Juzgado Civil y Comercial N°1', orden++, rosario.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_CIVIL_Y_COMERCIAL_N2_ROS', 'Juzgado Civil y Comercial N°2', orden++, rosario.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_DE_FAMILIA_N3_ROS', 'Juzgado de Familia N°3', orden++, rosario.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_PENAL_N1_ROS', 'Juzgado Penal N°1', orden++, rosario.id);
  await ensureParam(catRadicacion.id, 'CAMARA_DE_APELACIONES_EN_LO_CIVIL_ROS', 'Cámara de Apelaciones en lo Civil', orden++, rosario.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_LABORAL_N1_ROS', 'Juzgado Laboral N°1', orden++, rosario.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_LABORAL_N2_ROS', 'Juzgado Laboral N°2', orden++, rosario.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_FEDERAL_N1_ROS', 'Juzgado Federal N°1', orden++, rosario.id);
  await ensureParam(catRadicacion.id, 'TRIBUNAL_COLEGIADO_DE_FAMILIA_N5_ROS', 'Tribunal Colegiado de Familia N°5', orden++, rosario.id);

  // SAN LORENZO - todos con parentId = sanLorenzo.id
  await ensureParam(catRadicacion.id, 'JUZGADO_CIVIL_Y_COMERCIAL_N1_SL', 'Juzgado Civil y Comercial N°1', orden++, sanLorenzo.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_DE_FAMILIA_SL', 'Juzgado de Familia', orden++, sanLorenzo.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_LABORAL_SL', 'Juzgado Laboral', orden++, sanLorenzo.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_PENAL_SL', 'Juzgado Penal', orden++, sanLorenzo.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_DE_MENORES_SL', 'Juzgado de Menores', orden++, sanLorenzo.id);
  await ensureParam(catRadicacion.id, 'FISCALIA_REGIONAL_SL', 'Fiscalía Regional', orden++, sanLorenzo.id);
  await ensureParam(catRadicacion.id, 'TRIBUNAL_COLEGIADO_DE_FAMILIA_SL', 'Tribunal Colegiado de Familia', orden++, sanLorenzo.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_DE_CIRCUITO_SL', 'Juzgado de Circuito', orden++, sanLorenzo.id);

  // SANTA FÉ - todos con parentId = santaFe.id
  await ensureParam(catRadicacion.id, 'JUZGADO_CIVIL_Y_COMERCIAL_N1_SF', 'Juzgado Civil y Comercial N°1', orden++, santaFe.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_CIVIL_Y_COMERCIAL_N2_SF', 'Juzgado Civil y Comercial N°2', orden++, santaFe.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_LABORAL_N1_SF', 'Juzgado Laboral N°1', orden++, santaFe.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_DE_FAMILIA_SF', 'Juzgado de Familia', orden++, santaFe.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_PENAL_DE_INSTRUCCION_SF', 'Juzgado Penal de Instrucción', orden++, santaFe.id);
  await ensureParam(catRadicacion.id, 'FISCALIA_GENERAL_SF', 'Fiscalía General', orden++, santaFe.id);
  await ensureParam(catRadicacion.id, 'CAMARA_DE_APELACIONES_EN_LO_CIVIL_Y_COMERCIAL_SF', 'Cámara de Apelaciones en lo Civil y Comercial', orden++, santaFe.id);
  await ensureParam(catRadicacion.id, 'TRIBUNAL_COLEGIADO_DE_FAMILIA_SF', 'Tribunal Colegiado de Familia', orden++, santaFe.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_FEDERAL_N1_SF', 'Juzgado Federal N°1', orden++, santaFe.id);

  // CAÑADA DE GOMEZ - todos con parentId = canadaGomez.id
  await ensureParam(catRadicacion.id, 'JUZGADO_DE_FAMILIA_CG', 'Juzgado de Familia', orden++, canadaGomez.id);
  await ensureParam(catRadicacion.id, 'JUZGADO_DE_CIRCUITO_CG', 'Juzgado de Circuito', orden++, canadaGomez.id);

  console.log(`✅ ${orden - 1} parámetros de RADICACION creados`);

  // ========== CATEGORÍA 10: CONCEPTO_HONORARIO ==========
  const catConceptoHonorario = await prisma.categoria.findFirst({
    where: { codigo: 'CONCEPTO_HONORARIO' }
  });

  if (!catConceptoHonorario) {
    console.error('❌ Categoría CONCEPTO_HONORARIO no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catConceptoHonorario.nombre} (ID: ${catConceptoHonorario.id})...`);
  
  await ensureParam(catConceptoHonorario.id, 'HONORARIOS_REGULADOS', 'Honorarios regulados', 1);
  await ensureParam(catConceptoHonorario.id, 'HONORARIOS_PACTADOS', 'Honorarios pactados', 2);
  await ensureParam(catConceptoHonorario.id, 'CAJA_FORENSE', 'Caja forense', 3);
  await ensureParam(catConceptoHonorario.id, 'CAJA_DE_SEGURIDAD_SOCIAL', 'Caja de seguridad Social', 4);

  console.log(`✅ 4 parámetros de CONCEPTO_HONORARIO creados`);

  // ========== CATEGORÍA 11: PARTES ==========
  const catPartes = await prisma.categoria.findFirst({
    where: { codigo: 'PARTES' }
  });

  if (!catPartes) {
    console.error('❌ Categoría PARTES no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catPartes.nombre} (ID: ${catPartes.id})...`);
  
  await ensureParam(catPartes.id, 'CLIENTE', 'Cliente', 1);
  await ensureParam(catPartes.id, 'CONTRAPARTE', 'Contraparte', 2);

  console.log(`✅ 2 parámetros de PARTES creados`);

  // ========== CATEGORÍA 12: CONCEPTO_GASTO ==========
  const catConceptoGasto = await prisma.categoria.findFirst({
    where: { codigo: 'CONCEPTO_GASTO' }
  });

  if (!catConceptoGasto) {
    console.error('❌ Categoría CONCEPTO_GASTO no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catConceptoGasto.nombre} (ID: ${catConceptoGasto.id})...`);
  
  await ensureParam(catConceptoGasto.id, 'CEDULA_DE_NOTIFICACION', 'Cédula de notificación', 1);
  await ensureParam(catConceptoGasto.id, 'SELLADOS', 'Sellados', 2);
  await ensureParam(catConceptoGasto.id, 'SOLICITUD_DE_INFORMES', 'Solicitud de informes', 3);
  await ensureParam(catConceptoGasto.id, 'VIATICOS', 'Viáticos', 4);

  console.log(`✅ 4 parámetros de CONCEPTO_GASTO creados`);

  // ========== CATEGORÍA 13: CONCEPTO_INGRESO ==========
  const catConceptoIngreso = await prisma.categoria.findFirst({
    where: { codigo: 'CONCEPTO_INGRESO' }
  });

  if (!catConceptoIngreso) {
    console.error('❌ Categoría CONCEPTO_INGRESO no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catConceptoIngreso.nombre} (ID: ${catConceptoIngreso.id})...`);
  
  await ensureParam(catConceptoIngreso.id, 'ADELANTO_DE_GASTOS', 'Adelanto de gastos', 1);
  await ensureParam(catConceptoIngreso.id, 'PAGO_DE_HONORARIOS', 'Pago de honorarios', 2);
  await ensureParam(catConceptoIngreso.id, 'PAGO_POR_CONSULTA', 'Pago por consulta', 3);
  await ensureParam(catConceptoIngreso.id, 'REINTEGRO_DE_GASTO', 'Reintegro de gasto', 4);

  console.log(`✅ 4 parámetros de CONCEPTO_INGRESO creados`);

  // ========== CATEGORÍA 14: MONEDA ==========
  const catMoneda = await prisma.categoria.findFirst({
    where: { codigo: 'MONEDA' }
  });

  if (!catMoneda) {
    console.error('❌ Categoría MONEDA no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catMoneda.nombre} (ID: ${catMoneda.id})...`);
  
  await ensureParam(catMoneda.id, 'ARS', 'Peso', 1);
  await ensureParam(catMoneda.id, 'USD', 'Dólar', 2);
  await ensureParam(catMoneda.id, 'EUR', 'Euro', 3);
  await ensureParam(catMoneda.id, 'JUS', 'JUS', 4);

  console.log(`✅ 4 parámetros de MONEDA creados`);

  // ========== CATEGORÍA 15: ESTADO_INGRESO ==========
  const catEstadoIngreso = await prisma.categoria.findFirst({
    where: { codigo: 'ESTADO_INGRESO' }
  });

  if (!catEstadoIngreso) {
    console.error('❌ Categoría ESTADO_INGRESO no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catEstadoIngreso.nombre} (ID: ${catEstadoIngreso.id})...`);
  
  await ensureParam(catEstadoIngreso.id, 'PENDIENTE', 'Pendiente', 1);
  await ensureParam(catEstadoIngreso.id, 'CONFIRMADO', 'Confirmado', 2);
  await ensureParam(catEstadoIngreso.id, 'ANULADO', 'Anulado', 3);

  console.log(`✅ 3 parámetros de ESTADO_INGRESO creados`);

  // ========== CATEGORÍA 16: ESTADO_HONORARIO ==========
  const catEstadoHonorario = await prisma.categoria.findFirst({
    where: { codigo: 'ESTADO_HONORARIO' }
  });

  if (!catEstadoHonorario) {
    console.error('❌ Categoría ESTADO_HONORARIO no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catEstadoHonorario.nombre} (ID: ${catEstadoHonorario.id})...`);
  
  await ensureParam(catEstadoHonorario.id, 'PENDIENTE', 'Pendiente', 1);
  await ensureParam(catEstadoHonorario.id, 'ANULADO', 'Anulado', 2);
  await ensureParam(catEstadoHonorario.id, 'INCOBRABLE', 'Incobrable', 3);

  console.log(`✅ 3 parámetros de ESTADO_HONORARIO creados`);

  // ========== CATEGORÍA 17: TIPO_PERSONA ==========
  const catTipoPersona = await prisma.categoria.findFirst({
    where: { codigo: 'TIPO_PERSONA' }
  });

  if (!catTipoPersona) {
    console.error('❌ Categoría TIPO_PERSONA no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catTipoPersona.nombre} (ID: ${catTipoPersona.id})...`);
  
  await ensureParam(catTipoPersona.id, 'PERSONA_FISICA', 'Persona Fisica', 1);
  await ensureParam(catTipoPersona.id, 'PERSONA_JURIDICA', 'Persona Juridica', 2);

  console.log(`✅ 2 parámetros de TIPO_PERSONA creados`);

  // ========== CATEGORÍA 18: PERIODICIDAD ==========
  const catPeriodicidad = await prisma.categoria.findFirst({
    where: { codigo: 'PERIODICIDAD' }
  });

  if (!catPeriodicidad) {
    console.error('❌ Categoría PERIODICIDAD no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catPeriodicidad.nombre} (ID: ${catPeriodicidad.id})...`);
  
  await ensureParam(catPeriodicidad.id, 'SEMANAL', 'Semanal (7 días)', 1);
  await ensureParam(catPeriodicidad.id, 'QUINCENAL', 'Quincenal (15 días)', 2);
  await ensureParam(catPeriodicidad.id, 'MENSUAL', 'Mensual (30 días)', 3);
  await ensureParam(catPeriodicidad.id, 'PERSONALIZADA', 'Personalizada...', 4);

  console.log(`✅ 4 parámetros de PERIODICIDAD creados`);

  // ========== CATEGORÍA 19: ESTADO_CUOTA ==========
  const catEstadoCuota = await prisma.categoria.findFirst({
    where: { codigo: 'ESTADO_CUOTA' }
  });

  if (!catEstadoCuota) {
    console.error('❌ Categoría ESTADO_CUOTA no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catEstadoCuota.nombre} (ID: ${catEstadoCuota.id})...`);
  
  await ensureParam(catEstadoCuota.id, 'PENDIENTE', 'Pendiente', 1);
  await ensureParam(catEstadoCuota.id, 'PAGADA', 'Pagada', 2);
  await ensureParam(catEstadoCuota.id, 'VENCIDA', 'Vencida', 3);
  await ensureParam(catEstadoCuota.id, 'CONDONADA', 'Condonada', 4);
  await ensureParam(catEstadoCuota.id, 'PARCIAL', 'Parcial', 5);

  console.log(`✅ 5 parámetros de ESTADO_CUOTA creados`);

  // ========== CATEGORÍA 20: POLITICA_JUS ==========
  const catPoliticaJus = await prisma.categoria.findFirst({
    where: { codigo: 'POLITICA_JUS' }
  });

  if (!catPoliticaJus) {
    console.error('❌ Categoría POLITICA_JUS no encontrada. Ejecuta seedCategorias.js primero.');
    return;
  }

  console.log(`📂 Cargando parámetros para ${catPoliticaJus.nombre} (ID: ${catPoliticaJus.id})...`);
  
  await ensureParam(catPoliticaJus.id, 'FECHA_REGULACION', 'A Fecha Regulación', 1);
  await ensureParam(catPoliticaJus.id, 'AL_COBRO', 'Al Cobro', 2);

  console.log(`✅ 2 parámetros de POLITICA_JUS creados`);

  console.log('🎉 Seed de parámetros completado');

}

main()
  .then(() => console.log('✅ Seed ejecutado exitosamente'))
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

